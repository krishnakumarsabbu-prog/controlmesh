import json
import time
import structlog
from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.tools import agent_tool

from .base import GEMINI_MODEL, APP_ID, get_session_service
from bcl.observability.metrics import ORCHESTRATOR_RUNS, ORCHESTRATOR_DURATION, AGENT_TOOL_CALLS

log = structlog.get_logger()

_INSTRUCTION = """
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
Return ONLY a valid JSON object (no markdown, no commentary):
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
        instruction=_INSTRUCTION,
        tools=[
            agent_tool.AgentTool(agent=build_provisioning_agent()),
            agent_tool.AgentTool(agent=build_migration_agent()),
            agent_tool.AgentTool(agent=build_validation_agent()),
            agent_tool.AgentTool(agent=build_rollback_agent()),
        ],
    )


async def run_migration_step(
    app_id: str, source_qm: str, target_qm: str, snapshot_key: str
) -> dict:
    """
    Called by the BCL router after a snapshot is taken.
    Runs the orchestrator and drives the state machine based on the result.
    """
    from bcl.state.state_machine import MigrationStateMachine
    from bcl.state.redis_store import RedisStore
    from bcl.models.migration import MigrationState

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
        },
    )

    prompt = _build_migration_prompt(app_id, source_qm, target_qm, snapshot_key)

    log.info("orchestrator_start", app_id=app_id,
             source_qm=source_qm, target_qm=target_qm)

    start_time = time.monotonic()

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
            calls = event.get_function_calls() if hasattr(event, "get_function_calls") else []
            if calls:
                for call in calls:
                    await _emit_step_progress(app_id, call.name, sm)
                    AGENT_TOOL_CALLS.labels(
                        agent="orchestrator",
                        tool=call.name,
                        result="called",
                    ).inc()

        result = _parse_orchestrator_result(result_text)
        await _apply_final_state(app_id, result, sm)
        await sm.update_metadata(app_id, {"active_agent": None})

        duration = time.monotonic() - start_time
        status = result.get("status", "FAILED")
        ORCHESTRATOR_RUNS.labels(status=status).inc()
        ORCHESTRATOR_DURATION.observe(duration)

        log.info("orchestrator_complete", app_id=app_id,
                 status=status, duration_s=round(duration, 2))
        return result

    except Exception as exc:
        duration = time.monotonic() - start_time
        ORCHESTRATOR_RUNS.labels(status="FAILED").inc()
        ORCHESTRATOR_DURATION.observe(duration)

        log.error("orchestrator_exception", app_id=app_id, error=str(exc))
        await sm.transition(
            app_id,
            MigrationState.ROLLING_BACK,
            {"error": f"Orchestrator exception: {exc}"},
        )
        raise


def _build_migration_prompt(
    app_id: str, source_qm: str, target_qm: str, snapshot_key: str
) -> str:
    safe_id = app_id.replace("-", "").upper()
    return (
        f"Migrate application {app_id} from {source_qm} to {target_qm}. "
        f"The pre-migration snapshot key is '{snapshot_key}'. "
        f"The application has queues named Q.{safe_id}.*.LOCAL "
        f"currently on {source_qm}. "
        f"Target QM should be named {target_qm}. "
        f"DLQ on target should be Q.{safe_id}.DLQ.LOCAL. "
        f"Follow the full 6-step migration sequence and return JSON."
    )


def _parse_orchestrator_result(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1])
    return json.loads(text)


async def _apply_final_state(
    app_id: str, result: dict, sm
) -> None:
    from bcl.models.migration import MigrationState

    status = result.get("status")
    validation_results = result.get("validation_results", [])

    if status == "MIGRATED":
        await sm.transition(
            app_id,
            MigrationState.MIGRATED,
            {"validation_results": validation_results},
        )
    elif status == "ROLLED_BACK":
        await sm.transition(
            app_id,
            MigrationState.ROLLED_BACK,
            {"error": result.get("error")},
        )
    else:
        await sm.transition(
            app_id,
            MigrationState.ROLLING_BACK,
            {"error": result.get("error") or "Unknown failure"},
        )


async def _emit_step_progress(app_id: str, tool_name: str, sm) -> None:
    """Map agent tool calls to live state transitions for the UI SSE stream."""
    from bcl.models.migration import MigrationState

    mapping = {
        "provisioning_agent": (MigrationState.PROVISIONING_TARGET, "Provisioning Agent"),
        "migration_agent":    (MigrationState.REWIRING,            "Migration Agent"),
        "validation_agent":   (MigrationState.VALIDATING,          "Validation Agent"),
        "rollback_agent":     (MigrationState.ROLLING_BACK,        "Rollback Agent"),
    }
    match = mapping.get(tool_name)
    if match is None:
        return

    target_state, agent_name = match
    try:
        await sm.transition(
            app_id, target_state, {
                "triggered_by_tool": tool_name,
                "active_agent": agent_name
            }
        )
    except Exception:
        # If already in state, just update the active agent
        await sm.update_metadata(app_id, {"active_agent": agent_name})
