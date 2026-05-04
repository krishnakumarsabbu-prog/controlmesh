# Phase 4: Google ADK Agent Framework Setup

**Duration:** 3–4 days
**Objective:** Establish the multi-agent system foundation using the Google Agent Development Kit (ADK) with Gemini 2.0 Flash, implement base agent patterns, and wire up the agent mesh with the BCL gateway.

---

## Context and Rationale

The ADK agent mesh is what makes this solution agentic rather than just scripted automation. The Orchestrator agent receives high-level intent ("migrate APP1 from QM.SRC.A to QM.APP1") and reasons through the correct sequence of MQ operations, delegating to specialist agents via AgentTool wrappers. This approach means:

- The migration logic is expressed in natural language, auditable and explainable
- New migration patterns can be handled without code changes — the model reasons through them
- Failures are diagnosed by the model, which can attempt recovery steps before triggering rollback

The BCL **never** calls agent tools directly. Only the orchestrator is invoked by the BCL; all other agents are called exclusively by the orchestrator.

---

## Architecture

```
BCL FastAPI
    │
    │  runner.run_async(session, step_prompt)
    ▼
┌──────────────────────────────────────────────────────┐
│              Orchestrator Agent                       │
│  model: gemini-2.0-flash                              │
│  tools: delegate_to_provisioning                      │
│          delegate_to_migration                        │
│          delegate_to_validation                       │
│          delegate_to_rollback                         │
│  session: holds migration plan state across turns     │
└───────────┬──────────────────────────────────────────┘
            │  AgentTool delegation
    ┌───────┴────────────────────────────────┐
    ▼              ▼              ▼           ▼
Provisioning  Migration    Validation    Rollback
  Agent         Agent        Agent        Agent
  (Phase 6)    (Phase 7)    (Phase 8-ish) (Phase 9-ish)
    │              │              │           │
    └──────────────┴──────────────┴───────────┘
                   │
          Shared tool library
          mq_rest_tool · redis_state_tool · audit_log_tool
```

---

## Project Structure

```
agents/
├── __init__.py
├── base.py                    # Base agent class + common setup
├── orchestrator.py            # Orchestrator agent + runner
├── provisioning.py            # Provisioning specialist agent
├── migration_agent.py         # Migration specialist agent
├── validation_agent.py        # Validation specialist agent
├── rollback_agent.py          # Rollback specialist agent
├── tools/
│   ├── __init__.py
│   ├── mq_tools.py            # All MQ REST tool functions
│   ├── redis_tools.py         # Snapshot + state tools
│   └── audit_tools.py         # Audit log tools
└── tests/
    ├── test_orchestrator.py
    └── test_tools.py
```

---

## Implementation

### 4.1 Dependencies

```txt
# requirements.txt (agents section)
google-adk>=0.5.0
google-generativeai>=0.7.0
httpx>=0.27.0
aioredis>=2.0.0
structlog>=24.0.0
```

---

### 4.2 Base Agent Setup

```python
# agents/base.py
import os
import structlog
from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService

log = structlog.get_logger()

# Shared session service — maintains state across multi-turn agent calls
_session_service = InMemorySessionService()

def get_session_service() -> InMemorySessionService:
    return _session_service

def make_runner(agent: Agent) -> Runner:
    return Runner(
        agent=agent,
        app_name="mq-migration",
        session_service=_session_service,
    )

GEMINI_MODEL = "gemini-2.0-flash"
APP_ID = "mq-migration"
```

---

### 4.3 Shared Tool Library

```python
# agents/tools/mq_tools.py
"""
Thin Python functions called as ADK tool callbacks.
Each function calls the BCL's internal MQ REST client directly
(within the same process) to avoid HTTP round-trips.
"""
import structlog
from mq.registry import get_registry
from policy.engine import enforce_pre_operation

log = structlog.get_logger()

async def create_queue_manager(qm_logical_name: str, zone: str,
                               app_id: str) -> dict:
    """Create a new queue manager pod on OCP and register it in the BCL fleet."""
    from ocp.deployer import deploy_qm_pod
    from mq.registry import get_registry, QueueManagerEntry
    from mq.client import MQRestClient
    import os

    svc_url = f"https://{qm_logical_name.lower().replace('.', '-')}-svc:9443"
    await deploy_qm_pod(qm_logical_name, zone, app_id)

    registry = get_registry()
    registry.register(QueueManagerEntry(
        name=qm_logical_name,
        internal_name=qm_logical_name.replace(".", "")[:48],
        svc_url=svc_url,
        role="target",
        client=MQRestClient(svc_url, "admin", os.environ["MQ_ADMIN_PASSWORD"])
    ))
    log.info("tool_create_qm", qm=qm_logical_name, zone=zone, app=app_id)
    return {"status": "created", "qm": qm_logical_name, "svc_url": svc_url}

async def create_queue(qm_name: str, queue_name: str,
                       queue_type: str = "LOCAL", props: dict = None) -> dict:
    """Create a queue on the specified QM via MQ REST API."""
    props = props or {}
    await enforce_pre_operation(
        {"type": "create_queue", "object_type": "queue",
         "name": queue_name, **props},
        qm_name
    )
    registry = get_registry()
    qm = registry.get(qm_name)
    result = await qm.client.create_queue(
        qm.internal_name, queue_name,
        {"type": queue_type, **props}
    )
    log.info("tool_create_queue", qm=qm_name, queue=queue_name, type=queue_type)
    return {"status": "created", "queue": queue_name, "qm": qm_name}

async def set_dlq(qm_name: str, dlq_name: str) -> dict:
    """Create the Dead Letter Queue and set it as the QM's DLQ."""
    await create_queue(qm_name, dlq_name, "LOCAL",
                       {"description": "Dead Letter Queue"})
    registry = get_registry()
    qm = registry.get(qm_name)
    # Set DLQ on QM attributes
    import httpx
    r = await qm.client.client.patch(
        f"{qm.svc_url}/ibmmq/rest/v2/admin/qmgr/{qm.internal_name}",
        json={"deadLetterQueue": dlq_name},
        auth=qm.client.auth,
        headers={"ibm-mq-rest-csrf-token": "blank"}
    )
    r.raise_for_status()
    log.info("tool_set_dlq", qm=qm_name, dlq=dlq_name)
    return {"status": "dlq_set", "qm": qm_name, "dlq": dlq_name}

async def create_channel(qm_name: str, channel_name: str,
                         channel_type: str, props: dict = None) -> dict:
    """Create a channel on the specified QM."""
    props = props or {}
    await enforce_pre_operation(
        {"type": "create_channel", "object_type": "channel",
         "name": channel_name, "channel_type": channel_type, **props},
        qm_name
    )
    registry = get_registry()
    qm = registry.get(qm_name)
    result = await qm.client.create_channel(
        qm.internal_name, channel_name,
        {"type": channel_type, **props}
    )
    log.info("tool_create_channel", qm=qm_name, channel=channel_name)
    return {"status": "created", "channel": channel_name, "qm": qm_name}

async def create_xmit_queue(source_qm: str, xmit_queue_name: str,
                            target_qm: str) -> dict:
    """Create a transmission queue on the source QM for routing to target QM."""
    return await create_queue(
        source_qm, xmit_queue_name, "LOCAL",
        {
            "usage": "XMITQ",
            "description": f"Transmission queue to {target_qm}",
            "triggerControl": "TRIGGER",
            "triggerType": "FIRST",
        }
    )

async def create_remote_def(source_qm: str, remote_queue_name: str,
                             remote_q_name: str, remote_qm_name: str,
                             xmit_queue: str) -> dict:
    """Create a remote queue definition for transparent rewiring."""
    await enforce_pre_operation(
        {"type": "create_queue", "object_type": "queue",
         "name": remote_queue_name},
        source_qm
    )
    registry = get_registry()
    qm = registry.get(source_qm)
    result = await qm.client.create_queue(
        qm.internal_name, remote_queue_name,
        {
            "type": "REMOTE",
            "remoteQName": remote_q_name,
            "remoteQMgrName": remote_qm_name,
            "xmitQName": xmit_queue,
        }
    )
    log.info("tool_create_remote_def",
             source_qm=source_qm, remote_def=remote_queue_name,
             target_qm=remote_qm_name)
    return {"status": "created", "remote_def": remote_queue_name}
```

```python
# agents/tools/redis_tools.py
from state.redis_store import RedisStore

async def save_snapshot(app_id: str, step: str, topology: dict) -> str:
    store = RedisStore()
    key = await store.save_snapshot(app_id, step, topology)
    return key

async def load_snapshot(app_id: str) -> dict:
    store = RedisStore()
    return await store.load_latest_snapshot(app_id)
```

```python
# agents/tools/audit_tools.py
from state.redis_store import RedisStore
import time

async def log_audit_event(operation: str, qm_target: str,
                           agent: str, result: str,
                           trace_id: str = "", details: dict = None) -> dict:
    store = RedisStore()
    event = {
        "operation": operation,
        "qm_target": qm_target,
        "agent": agent,
        "result": result,
        "trace_id": trace_id,
        "details": details or {},
        "timestamp": time.time(),
    }
    await store.append_audit(event)
    return {"logged": True}
```

---

### 4.4 Orchestrator Agent (Skeleton — Full impl in Phase 5)

```python
# agents/orchestrator.py
import structlog
from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.tools import agent_tool
from .base import GEMINI_MODEL, APP_ID, get_session_service

log = structlog.get_logger()

ORCHESTRATOR_INSTRUCTION = """
You are the Migration Orchestrator for an IBM MQ topology migration system.

Your job is to plan and execute the migration of a single application from a
shared source queue manager to its own dedicated target queue manager.

You coordinate four specialist agents:
- provisioning_agent: creates QM objects (queues, channels, DLQ)
- migration_agent: handles topology diffing and transparent rewiring
- validation_agent: tests message flows before, during, after migration
- rollback_agent: restores pre-migration state from Redis snapshots

Rules:
1. Always validate BEFORE any rewiring starts (baseline)
2. After rewiring, validate again (transparent flow test)
3. If any validation fails, immediately invoke rollback_agent
4. Never skip DLQ creation — provisioning_agent must set_dlq before any other queue
5. Naming conventions are enforced by BCL policy — use correct patterns
6. Emit audit log entries at each major step

Return a structured JSON result with:
{
  "status": "MIGRATED" | "ROLLED_BACK" | "FAILED",
  "steps_completed": [...],
  "validation_results": [...],
  "error": null | "description"
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

async def run_migration_step(app_id: str, source_qm: str,
                              target_qm: str, snapshot_key: str) -> dict:
    from state.state_machine import MigrationStateMachine
    from state.redis_store import RedisStore
    from models.migration import MigrationState

    sm = MigrationStateMachine(RedisStore())
    orchestrator = build_orchestrator()
    session_service = get_session_service()
    runner = Runner(agent=orchestrator, app_name=APP_ID,
                    session_service=session_service)

    session = await session_service.create_session(
        app_name=APP_ID, user_id=app_id
    )

    prompt = (
        f"Migrate application {app_id} from {source_qm} to {target_qm}. "
        f"The pre-migration snapshot is stored at key {snapshot_key}. "
        f"Follow the standard migration sequence: "
        f"1) baseline validation, 2) provision target QM with DLQ, "
        f"3) rewire flows, 4) post-rewire validation, 5) cutover, "
        f"6) final validation. Roll back automatically if any validation fails."
    )

    try:
        result_text = ""
        async for event in runner.run_async(
            session_id=session.id, user_id=app_id,
            new_message=prompt
        ):
            if event.is_final_response():
                result_text = event.content.parts[0].text

        import json
        result = json.loads(result_text)
        final_state = MigrationState(result.get("status", "ROLLED_BACK"))
        await sm.transition(app_id, final_state,
                            {"steps": result.get("steps_completed", [])})
        return result

    except Exception as e:
        log.error("orchestrator_error", app_id=app_id, error=str(e))
        await sm.transition(app_id, MigrationState.ROLLING_BACK,
                            {"error": str(e)})
        raise
```

---

## OCP Deployment for Agent Layer

The ADK agents run inside the BCL pod (same process). No separate deployment needed. The Gemini API is called via HTTPS from the BCL pod.

```yaml
# Add to bcl-deployment.yaml env:
- name: GOOGLE_API_KEY
  valueFrom:
    secretKeyRef:
      name: google-api-creds
      key: api_key
```

```bash
oc create secret generic google-api-creds \
  --from-literal=api_key='<your-gemini-api-key>' \
  -n mq-hackathon
```

---

## Success Criteria

| Criterion | Verification |
|-----------|-------------|
| ADK installed and importable | `python -c "from google.adk.agents import Agent"` |
| Orchestrator builds without error | Unit test instantiates agent |
| Tool functions reachable from agent | Mock tool call returns expected dict |
| Session persists across turns | Multi-turn test shows state in session |
| Gemini API reachable from OCP pod | `oc exec bcl-pod -- python -c "import google.generativeai; print('ok')"` |
| Agent runner returns structured JSON | Integration test with mock MQ |
