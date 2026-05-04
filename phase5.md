# Phase 5: Orchestrator Agent Implementation

**Duration:** 3–4 days
**Objective:** Build the Orchestrator Agent — the single entry point the BCL calls — that plans, sequences, and delegates the full migration workflow across all specialist agents.

---

## Context and Rationale

The Orchestrator is the brain of the system. It receives a natural-language step prompt from the BCL and must:
1. Reason about the correct sequence of operations
2. Delegate each substep to the right specialist agent via AgentTool
3. Collect and aggregate results from all delegations
4. Decide whether to commit the step or trigger rollback
5. Return a structured JSON outcome to the BCL

The Orchestrator holds migration plan state in the ADK Session context across multi-turn tool calls. This means it can ask the validation agent a question, wait for the answer, and then decide next steps — all within one `runner.run_async()` invocation.

---

## Orchestrator Responsibilities

```
BCL calls runner.run_async(session, prompt)
              │
              ▼
    ┌─────────────────────┐
    │   Orchestrator       │
    │                      │
    │  1. Parse intent      │
    │  2. Plan steps        │
    │  3. Execute via tools │
    │  4. Validate results  │
    │  5. Commit or rollback│
    │  6. Return JSON       │
    └─────────────────────┘
         │        │        │        │
    Provision  Migrate  Validate  Rollback
```

---

## Full Implementation

### 5.1 Orchestrator Agent

```python
# agents/orchestrator.py
import json
import structlog
from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.tools import agent_tool
from .base import GEMINI_MODEL, APP_ID, get_session_service

log = structlog.get_logger()

ORCHESTRATOR_INSTRUCTION = """
You are the IBM MQ Migration Orchestrator. You manage end-to-end migration of
a single application from a shared source queue manager to its own dedicated
target queue manager.

## Your tools
- provisioning_agent: creates new QM pods, queues, channels, and DLQs
- migration_agent: diffs topologies and installs transparent rewiring
- validation_agent: sends test messages and verifies delivery
- rollback_agent: restores pre-migration state from Redis snapshots

## Migration sequence (ALWAYS follow this order)
1. BASELINE VALIDATION — call validation_agent to confirm source flows work
2. PROVISION TARGET — call provisioning_agent to create target QM + DLQ +
   all required queues and channels
3. REWIRE — call migration_agent to install xmit queue + remote queue defs
   on source QM so producers transparently route to target QM
4. POST-REWIRE VALIDATION — call validation_agent to confirm transparent
   routing works (producer unchanged, messages arrive at target)
5. CUTOVER — call migration_agent to remove local queue from source QM
6. FINAL VALIDATION — call validation_agent to confirm final state

## Automatic rollback rules
- If BASELINE VALIDATION fails: abort and return FAILED (do NOT proceed)
- If PROVISIONING fails: call rollback_agent, return ROLLED_BACK
- If REWIRING fails: call rollback_agent, return ROLLED_BACK
- If POST-REWIRE VALIDATION fails: call rollback_agent, return ROLLED_BACK
- If CUTOVER fails: call rollback_agent, return ROLLED_BACK
- If FINAL VALIDATION fails: call rollback_agent, return ROLLED_BACK

## Naming conventions you must use
- Queue managers: QM.<ZONE>.<APP> (e.g., QM.APP1, QM.SRC.A)
- Queues: Q.<APP>.<PURPOSE>.<TYPE> (e.g., Q.APP1.REQUEST.LOCAL)
- Channels: CHL.<SRC>.<TGT> (e.g., CHL.SRCA.APP1)
- Listeners: LST.<APP>.<PORT> (e.g., LST.APP1.1414)
- Dead Letter Queue: Q.<APP>.DLQ.LOCAL

## Response format
Always return a JSON object:
{
  "status": "MIGRATED" | "ROLLED_BACK" | "FAILED",
  "app_id": "<app_id>",
  "source_qm": "<qm>",
  "target_qm": "<qm>",
  "steps_completed": ["BASELINE_VALIDATION", "PROVISION_TARGET", ...],
  "validation_results": [
    {"phase": "BASELINE", "passed": true, "latency_ms": 42},
    {"phase": "POST_REWIRE", "passed": true, "latency_ms": 38},
    {"phase": "FINAL", "passed": true, "latency_ms": 35}
  ],
  "error": null
}
"""

def build_orchestrator() -> Agent:
    from .provisioning import build_provisioning_agent
    from .migration_agent import build_migration_agent
    from .validation_agent import build_validation_agent
    from .rollback_agent import build_rollback_agent

    return Agent(
        name="orchestrator",
        model=GEMINI_MODEL,
        instruction=ORCHESTRATOR_INSTRUCTION,
        tools=[
            agent_tool.AgentTool(agent=build_provisioning_agent()),
            agent_tool.AgentTool(agent=build_migration_agent()),
            agent_tool.AgentTool(agent=build_validation_agent()),
            agent_tool.AgentTool(agent=build_rollback_agent()),
        ],
    )
```

---

### 5.2 Migration Runner (called by BCL)

```python
# agents/orchestrator.py (continued)
from state.state_machine import MigrationStateMachine
from state.redis_store import RedisStore
from models.migration import MigrationState

async def run_migration_step(app_id: str, source_qm: str,
                              target_qm: str, snapshot_key: str) -> dict:
    """
    Called by BCL router after snapshot is taken.
    Runs the orchestrator and updates the state machine based on result.
    """
    sm = MigrationStateMachine(RedisStore())
    orchestrator = build_orchestrator()
    session_service = get_session_service()

    runner = Runner(
        agent=orchestrator,
        app_name=APP_ID,
        session_service=session_service,
    )

    session = await session_service.create_session(
        app_name=APP_ID,
        user_id=app_id,
        state={
            "app_id": app_id,
            "source_qm": source_qm,
            "target_qm": target_qm,
            "snapshot_key": snapshot_key,
        }
    )

    prompt = _build_migration_prompt(app_id, source_qm, target_qm, snapshot_key)

    log.info("orchestrator_start", app_id=app_id,
             source_qm=source_qm, target_qm=target_qm)

    try:
        result_text = ""
        async for event in runner.run_async(
            session_id=session.id,
            user_id=app_id,
            new_message=prompt,
        ):
            if event.is_final_response():
                result_text = event.content.parts[0].text
                break
            # Emit intermediate state updates to UI via SSE
            elif event.get_function_calls():
                for call in event.get_function_calls():
                    await _emit_step_progress(app_id, call.name, sm)

        result = _parse_orchestrator_result(result_text)
        await _apply_final_state(app_id, result, sm)

        log.info("orchestrator_complete",
                 app_id=app_id, status=result["status"])
        return result

    except Exception as e:
        log.error("orchestrator_exception", app_id=app_id, error=str(e))
        await sm.transition(app_id, MigrationState.ROLLING_BACK,
                            {"error": f"Orchestrator exception: {e}"})
        raise

def _build_migration_prompt(app_id: str, source_qm: str,
                             target_qm: str, snapshot_key: str) -> str:
    return (
        f"Migrate application {app_id} from {source_qm} to {target_qm}. "
        f"The pre-migration snapshot key is '{snapshot_key}'. "
        f"The application has queues named Q.{app_id.replace('-', '')}.*.LOCAL "
        f"currently on {source_qm}. "
        f"Target QM should be named QM.{app_id.upper()}. "
        f"DLQ on target should be Q.{app_id.upper()}.DLQ.LOCAL. "
        f"Follow the full 6-step migration sequence and return JSON."
    )

def _parse_orchestrator_result(text: str) -> dict:
    # Strip markdown code fences if present
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1])
    return json.loads(text)

async def _apply_final_state(app_id: str, result: dict,
                              sm: MigrationStateMachine):
    status = result.get("status")
    if status == "MIGRATED":
        await sm.transition(app_id, MigrationState.MIGRATED,
                            {"validation_results": result.get("validation_results", [])})
    elif status == "ROLLED_BACK":
        await sm.transition(app_id, MigrationState.ROLLED_BACK,
                            {"error": result.get("error")})
    else:
        await sm.transition(app_id, MigrationState.ROLLING_BACK,
                            {"error": result.get("error", "Unknown failure")})

async def _emit_step_progress(app_id: str, tool_name: str,
                               sm: MigrationStateMachine):
    """Map tool call names to state transitions for live UI updates."""
    mapping = {
        "provisioning_agent": MigrationState.PROVISIONING_TARGET,
        "migration_agent": MigrationState.REWIRING,
        "validation_agent": MigrationState.VALIDATING,
        "rollback_agent": MigrationState.ROLLING_BACK,
    }
    if tool_name in mapping:
        try:
            await sm.transition(app_id, mapping[tool_name],
                                {"triggered_by_tool": tool_name})
        except Exception:
            pass  # Already in this state is fine
```

---

### 5.3 Session Management

The ADK Session holds migration context across multi-turn calls. This allows the orchestrator to call the validation agent, receive a result, then decide to call the migration agent — all as a reasoning chain.

```python
# agents/session_manager.py
from google.adk.sessions import InMemorySessionService
from typing import Optional

_sessions: dict = {}
_service = InMemorySessionService()

async def get_or_create_session(app_id: str, initial_state: dict = None):
    existing = _sessions.get(app_id)
    if existing:
        return existing
    session = await _service.create_session(
        app_name="mq-migration",
        user_id=app_id,
        state=initial_state or {}
    )
    _sessions[app_id] = session
    return session

async def clear_session(app_id: str):
    if app_id in _sessions:
        del _sessions[app_id]
```

---

### 5.4 Orchestrator Monitoring Metrics

```python
# agents/metrics.py
from prometheus_client import Counter, Histogram

ORCHESTRATOR_RUNS = Counter(
    "orchestrator_runs_total",
    "Total orchestrator runs",
    ["status"]  # MIGRATED, ROLLED_BACK, FAILED
)

ORCHESTRATOR_DURATION = Histogram(
    "orchestrator_duration_seconds",
    "Time taken for full migration orchestration",
    buckets=[5, 15, 30, 60, 120, 300, 600]
)

AGENT_TOOL_CALLS = Counter(
    "agent_tool_calls_total",
    "Tool calls made by agents",
    ["agent", "tool", "result"]
)
```

---

## Testing Strategy

### Unit Tests

```python
# agents/tests/test_orchestrator.py
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import json

@pytest.mark.asyncio
async def test_successful_migration_returns_migrated():
    """Orchestrator returns MIGRATED when all steps pass."""
    mock_result = json.dumps({
        "status": "MIGRATED",
        "app_id": "APP1",
        "source_qm": "QM.SRC.A",
        "target_qm": "QM.APP1",
        "steps_completed": ["BASELINE_VALIDATION", "PROVISION_TARGET",
                             "REWIRING", "POST_REWIRE_VALIDATION",
                             "CUTOVER", "FINAL_VALIDATION"],
        "validation_results": [
            {"phase": "BASELINE", "passed": True, "latency_ms": 42},
            {"phase": "POST_REWIRE", "passed": True, "latency_ms": 38},
            {"phase": "FINAL", "passed": True, "latency_ms": 35},
        ],
        "error": None
    })

    with patch("agents.orchestrator.Runner") as MockRunner:
        mock_runner = AsyncMock()
        MockRunner.return_value = mock_runner
        mock_event = MagicMock()
        mock_event.is_final_response.return_value = True
        mock_event.content.parts = [MagicMock(text=mock_result)]
        mock_event.get_function_calls.return_value = []

        async def mock_run_async(**kwargs):
            yield mock_event

        mock_runner.run_async = mock_run_async

        from agents.orchestrator import run_migration_step
        with patch("agents.orchestrator.MigrationStateMachine"):
            result = await run_migration_step(
                "APP1", "QM.SRC.A", "QM.APP1", "snapshot:APP1:pre:123"
            )

    assert result["status"] == "MIGRATED"
    assert len(result["steps_completed"]) == 6

@pytest.mark.asyncio
async def test_validation_failure_triggers_rollback():
    """When validation fails in orchestrator response, state becomes ROLLED_BACK."""
    mock_result = json.dumps({
        "status": "ROLLED_BACK",
        "app_id": "APP1",
        "steps_completed": ["BASELINE_VALIDATION", "PROVISION_TARGET", "REWIRING"],
        "validation_results": [
            {"phase": "BASELINE", "passed": True, "latency_ms": 42},
            {"phase": "POST_REWIRE", "passed": False, "latency_ms": 5001},
        ],
        "error": "POST_REWIRE validation failed: message not delivered within 5s"
    })
    # ... similar mock setup
    # assert state_machine.transition called with ROLLED_BACK
```

---

## Error Handling Matrix

| Failure Scenario | Orchestrator Behavior | Final State |
|-----------------|----------------------|-------------|
| Baseline validation fails | Abort migration, no changes | `FAILED` |
| Target QM creation fails | Trigger rollback agent | `ROLLED_BACK` |
| Xmit queue creation fails | Trigger rollback agent | `ROLLED_BACK` |
| Post-rewire validation fails | Trigger rollback agent | `ROLLED_BACK` |
| Cutover fails | Trigger rollback agent | `ROLLED_BACK` |
| Final validation fails | Trigger rollback agent | `ROLLED_BACK` |
| Gemini API timeout | Trigger rollback, log error | `ROLLED_BACK` |
| BCL pod restart mid-migration | Startup recovery rollback | `ROLLED_BACK` |

---

## Success Criteria

| Criterion | Verification |
|-----------|-------------|
| Orchestrator delegates to all 4 specialist agents | Integration test trace shows all AgentTool calls |
| Session state persists across multi-turn calls | Session inspection after each turn |
| State machine transitions correctly driven by tool calls | Unit test with mocked agents |
| Rollback triggered on any validation failure | Integration test with simulated failure |
| Structured JSON returned for all outcomes | Assert on result schema |
| Prometheus metrics incremented | Check `/metrics` after test run |
| SSE events emitted during execution | WebSocket client receives step events |
