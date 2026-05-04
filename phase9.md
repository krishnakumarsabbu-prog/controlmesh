# Phase 9: Rollback Agent Implementation

**Duration:** 2–3 days
**Objective:** Build the Rollback Agent — the specialist that restores pre-migration state from Redis snapshots, removes rewiring artefacts, and confirms the system has returned to a known-good state.

---

## Context and Rationale

The Rollback Agent is the safety net's safety net. It is triggered automatically by the Orchestrator whenever any validation fails. It must:

1. Load the pre-migration topology snapshot from Redis
2. Remove all rewiring artefacts (xmit queue, remote def, sender/receiver channels)
3. Restore the original local queue if it was removed during cutover
4. Confirm the source topology is intact by running a restoration validation
5. Update the state machine to `ROLLED_BACK`

Rollback must be **idempotent** — safe to call multiple times. Calling it twice should produce the same result as calling it once. This is critical because the BCL pod may restart mid-rollback.

---

## Rollback Sequence

```
Trigger: Orchestrator calls rollback_agent after validation failure
    │
    ▼
1. load_snapshot(app_id) from Redis
    │
    ▼
2. delete_remote_def on source QM (if exists)
    │
    ▼
3. stop_channel + delete_sender_channel on source QM (if exists)
    │
    ▼
4. delete_receiver_channel on target QM (if exists)
    │
    ▼
5. delete_xmit_queue on source QM (if exists)
    │
    ▼
6. restore_queue — re-create original LOCAL queue on source QM
   (only if it was deleted during cutover)
    │
    ▼
7. Run restoration validation (put/get on source QM)
    │
    ▼
8. Emit ROLLED_BACK state + audit event
    │
    ▼
Return: { "status": "ROLLED_BACK", "verified": true }
```

---

## Rollback Agent

### 9.1 Agent Definition

```python
# agents/rollback_agent.py
from google.adk.agents import Agent
from .base import GEMINI_MODEL
from .tools.rollback_tools import (
    load_snapshot,
    delete_remote_def_safe,
    delete_xmit_queue_safe,
    stop_channel_safe,
    delete_channel_safe,
    restore_queue,
    verify_rollback,
)
from .tools.audit_tools import log_audit_event

ROLLBACK_INSTRUCTION = """
You are the IBM MQ Rollback Agent. Your job is to restore the pre-migration
state when a migration step fails or validation detects broken flows.

## Tools available
- load_snapshot(app_id) → pre-migration topology from Redis
- delete_remote_def_safe(qm_name, remote_def_name) → idempotent delete
- delete_xmit_queue_safe(qm_name, xmit_queue_name) → idempotent delete
- stop_channel_safe(qm_name, channel_name) → stop channel if running
- delete_channel_safe(qm_name, channel_name) → idempotent delete
- restore_queue(qm_name, queue_name, queue_props) → recreate if missing
- verify_rollback(app_id, source_qm) → run put/get to confirm source works
- log_audit_event(operation, qm_target, agent, result)

## Rollback sequence (ALWAYS in this order)
1. load_snapshot — identify exactly what was in place before migration
2. delete_remote_def_safe — remove transparent routing definition
3. stop_channel_safe — stop SDR channel (source QM)
4. delete_channel_safe — remove SDR channel (source QM)
5. delete_channel_safe — remove RCVR channel (target QM)
6. delete_xmit_queue_safe — remove transmission queue (source QM)
7. restore_queue — if original local queue was removed, recreate it
   using properties from the snapshot
8. verify_rollback — send test message through source QM to confirm
   the original flow works again
9. log_audit_event with result

## Idempotency rule
ALL delete/stop operations must be safe to call even if the object
doesn't exist (return success if already absent).

## Response format
{
  "status": "ROLLED_BACK" | "ROLLBACK_FAILED",
  "app_id": "<id>",
  "objects_removed": ["<list>"],
  "objects_restored": ["<list>"],
  "verified": true | false,
  "error": null | "<description>"
}
"""

def build_rollback_agent() -> Agent:
    return Agent(
        name="rollback_agent",
        model=GEMINI_MODEL,
        instruction=ROLLBACK_INSTRUCTION,
        tools=[
            load_snapshot,
            delete_remote_def_safe,
            delete_xmit_queue_safe,
            stop_channel_safe,
            delete_channel_safe,
            restore_queue,
            verify_rollback,
            log_audit_event,
        ],
    )
```

---

### 9.2 Rollback Tools

```python
# agents/tools/rollback_tools.py
import structlog
from typing import Optional

log = structlog.get_logger()

async def load_snapshot(app_id: str) -> dict:
    """Load the pre-migration topology snapshot from Redis."""
    from state.redis_store import RedisStore
    store = RedisStore()
    snapshot = await store.load_latest_snapshot(app_id)
    if snapshot is None:
        return {"error": f"No snapshot found for {app_id}", "snapshot": None}
    log.info("rollback_snapshot_loaded", app_id=app_id)
    return {"snapshot": snapshot, "app_id": app_id}

async def delete_remote_def_safe(qm_name: str,
                                  remote_def_name: str) -> dict:
    """Delete a remote queue definition. Returns success even if not found."""
    from mq.registry import get_registry
    try:
        registry = get_registry()
        qm = registry.get(qm_name)
        await qm.client.delete_queue(qm.internal_name, remote_def_name)
        log.info("rollback_deleted_remote_def", qm=qm_name, name=remote_def_name)
        return {"status": "deleted", "object": remote_def_name}
    except Exception as e:
        if "MQRC_UNKNOWN_OBJECT_NAME" in str(e) or "404" in str(e):
            log.info("rollback_remote_def_already_absent",
                     qm=qm_name, name=remote_def_name)
            return {"status": "already_absent", "object": remote_def_name}
        raise

async def delete_xmit_queue_safe(qm_name: str,
                                  xmit_queue_name: str) -> dict:
    """Delete xmit queue. Returns success if not found."""
    from mq.registry import get_registry
    try:
        registry = get_registry()
        qm = registry.get(qm_name)
        await qm.client.delete_queue(qm.internal_name, xmit_queue_name)
        return {"status": "deleted", "object": xmit_queue_name}
    except Exception as e:
        if "404" in str(e) or "UNKNOWN_OBJECT" in str(e):
            return {"status": "already_absent", "object": xmit_queue_name}
        raise

async def stop_channel_safe(qm_name: str, channel_name: str) -> dict:
    """Stop a channel. Safe to call if already stopped."""
    from mq.registry import get_registry
    try:
        registry = get_registry()
        qm = registry.get(qm_name)
        r = await qm.client.client.post(
            f"{qm.svc_url}/ibmmq/rest/v2/admin/action/qmgr"
            f"/{qm.internal_name}/channel/{channel_name}/stop",
            auth=qm.client.auth,
            headers={"ibm-mq-rest-csrf-token": "blank"}
        )
        if r.status_code in (200, 201):
            return {"status": "stopped", "channel": channel_name}
        return {"status": "already_stopped", "channel": channel_name}
    except Exception:
        return {"status": "already_absent_or_stopped", "channel": channel_name}

async def delete_channel_safe(qm_name: str, channel_name: str) -> dict:
    """Delete a channel. Safe to call if not found."""
    from mq.registry import get_registry
    try:
        registry = get_registry()
        qm = registry.get(qm_name)
        r = await qm.client.client.delete(
            f"{qm.svc_url}/ibmmq/rest/v2/admin/qmgr"
            f"/{qm.internal_name}/channel/{channel_name}",
            auth=qm.client.auth,
            headers={"ibm-mq-rest-csrf-token": "blank"}
        )
        if r.status_code in (200, 204):
            return {"status": "deleted", "channel": channel_name}
        return {"status": "already_absent", "channel": channel_name}
    except Exception:
        return {"status": "already_absent", "channel": channel_name}

async def restore_queue(qm_name: str, queue_name: str,
                         queue_props: Optional[dict] = None) -> dict:
    """
    Re-create a local queue if it is missing.
    Used when cutover deleted the source queue and rollback needs to restore it.
    """
    from mq.registry import get_registry
    from policy.engine import enforce_pre_operation

    registry = get_registry()
    qm = registry.get(qm_name)

    # Check if queue already exists
    r = await qm.client.client.get(
        f"{qm.svc_url}/ibmmq/rest/v2/admin/qmgr"
        f"/{qm.internal_name}/queue/{queue_name}",
        auth=qm.client.auth
    )

    if r.status_code == 200:
        log.info("rollback_queue_already_present",
                 qm=qm_name, queue=queue_name)
        return {"status": "already_present", "queue": queue_name}

    # Recreate
    await enforce_pre_operation(
        {"type": "create_queue", "object_type": "queue", "name": queue_name},
        qm_name
    )

    props = queue_props or {"description": "Restored by rollback agent"}
    await qm.client.create_queue(qm.internal_name, queue_name,
                                  {"type": "LOCAL", **props})

    log.info("rollback_queue_restored", qm=qm_name, queue=queue_name)
    return {"status": "restored", "queue": queue_name}

async def verify_rollback(app_id: str, source_qm: str) -> dict:
    """
    Confirm rollback success by putting/getting a test message
    through the restored source topology.
    """
    from agents.tools.validation_tools import (
        put_test_message, get_test_message, assert_delivery
    )
    import uuid

    # Find the app's request queue
    queue_name = f"Q.{app_id.upper()}.REQUEST.LOCAL"
    corr_id = str(uuid.uuid4()).replace("-", "")[:24]

    put_result = await put_test_message(
        source_qm, queue_name, f"ROLLBACK_VERIFY_{app_id}", corr_id
    )

    get_result = await get_test_message(
        source_qm, queue_name, corr_id, timeout_seconds=5
    )

    assertion = await assert_delivery(corr_id, get_result)

    log.info("rollback_verify",
             app_id=app_id, source_qm=source_qm,
             passed=assertion["passed"],
             latency_ms=assertion["latency_ms"])

    return {
        "verified": assertion["passed"],
        "latency_ms": assertion["latency_ms"],
        "app_id": app_id,
        "source_qm": source_qm,
    }
```

---

### 9.3 Automated Rollback Runner

```python
# agents/rollback_agent.py (runner function)

async def run_rollback(app_id: str) -> dict:
    """
    Called by BCL or Orchestrator to execute automated rollback.
    Invokes the rollback agent and updates state machine on completion.
    """
    from state.state_machine import MigrationStateMachine
    from state.redis_store import RedisStore
    from models.migration import MigrationState
    from google.adk.runners import Runner
    from agents.base import get_session_service, APP_ID
    import json, structlog

    log = structlog.get_logger()
    sm = MigrationStateMachine(RedisStore())

    record = await sm.get(app_id)
    source_qm = record.source_qm

    agent = build_rollback_agent()
    session_service = get_session_service()
    runner = Runner(agent=agent, app_name=APP_ID,
                    session_service=session_service)

    session = await session_service.create_session(
        app_name=APP_ID, user_id=f"rollback-{app_id}"
    )

    prompt = (
        f"Roll back the failed migration of {app_id}. "
        f"Source QM is {source_qm}. "
        f"Target QM was QM.{app_id.upper()}. "
        f"Remove all rewiring artefacts and restore source topology. "
        f"Return JSON rollback result."
    )

    result_text = ""
    async for event in runner.run_async(
        session_id=session.id,
        user_id=f"rollback-{app_id}",
        new_message=prompt,
    ):
        if event.is_final_response():
            result_text = event.content.parts[0].text

    result = json.loads(result_text)

    if result.get("status") == "ROLLED_BACK":
        await sm.transition(app_id, MigrationState.ROLLED_BACK,
                            {"verified": result.get("verified", False)})
    else:
        log.error("rollback_failed", app_id=app_id, result=result)

    return result
```

---

## Rollback Evidence Format

Demonstrated rollback produces this evidence record:

```json
{
  "rollback_event": {
    "app_id": "APP1",
    "triggered_by": "POST_REWIRE validation failure",
    "trigger_timestamp": "2025-05-04T10:03:45Z",
    "rollback_completed_at": "2025-05-04T10:03:52Z",
    "duration_seconds": 7,
    "objects_removed": [
      "Q.APP1.REQUEST.LOCAL (REMOTE def on QM.SRC.A)",
      "CHL.SRCA.APP1 (SDR on QM.SRC.A)",
      "CHL.SRCA.APP1 (RCVR on QM.APP1)",
      "Q.SRCA.APP1.XMIT.XMIT (on QM.SRC.A)"
    ],
    "objects_restored": [
      "Q.APP1.REQUEST.LOCAL (LOCAL on QM.SRC.A)"
    ],
    "restoration_validation": {
      "passed": true,
      "latency_ms": 44
    },
    "final_state": "ROLLED_BACK",
    "signals_emitted": [
      "GET /healthz/ready → 200 (QM.SRC.A reachable)",
      "GET /api/migration/status → state: ROLLED_BACK",
      "SSE event: {event: state_change, state: ROLLED_BACK}",
      "Audit log entry: ROLLBACK_COMPLETE"
    ]
  }
}
```

---

## Success Criteria

| Criterion | Verification |
|-----------|-------------|
| Rollback triggered automatically on validation failure | Integration test with forced failure |
| All rewiring artefacts removed | `GET /api/queues?qm=QM.SRC.A` — no xmit/remote queues |
| Source queue restored if deleted | Queue present on source QM after rollback |
| Restoration validation passes | Rollback result shows `verified: true` |
| Idempotent — safe to call twice | Second rollback call returns same result |
| State machine moves to ROLLED_BACK | `GET /api/migration/status` shows ROLLED_BACK |
| Clear signals emitted | Health probe, SSE, audit all show ROLLED_BACK |
