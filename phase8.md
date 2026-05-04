# Phase 8: Validation Agent Implementation

**Duration:** 2–3 days
**Objective:** Build the Validation Agent — the specialist that tests message flows before, during, and after migration using correlated put/get test messages, and returns pass/fail results with latency metrics.

---

## Context and Rationale

Validation is the safety net of the entire migration system. The Orchestrator calls the Validation Agent at three critical points:

1. **Baseline** — before any migration begins, confirms source flows work
2. **Post-rewire** — after xmit queue + remote def installed, confirms transparent routing
3. **Final** — after cutover, confirms the fully migrated state

If any validation fails, the Orchestrator immediately triggers the Rollback Agent. Validation failures are the primary automated rollback trigger.

The validation mechanism uses **correlated test messages**: the agent PUTs a message with a unique correlation ID, then attempts to GET it from the expected destination queue. Match = pass, timeout = fail.

---

## Validation Agent

### 8.1 Agent Definition

```python
# agents/validation_agent.py
from google.adk.agents import Agent
from .base import GEMINI_MODEL
from .tools.validation_tools import (
    put_test_message,
    get_test_message,
    assert_delivery,
    report_result,
    check_queue_depth,
    check_channel_status,
)
from .tools.audit_tools import log_audit_event

VALIDATION_INSTRUCTION = """
You are the IBM MQ Validation Agent. Your job is to validate that message
flows are working correctly at three phases: BASELINE, POST_REWIRE, FINAL.

## Tools available
- put_test_message(qm_name, queue_name, message_body, correlation_id)
- get_test_message(qm_name, queue_name, correlation_id, timeout_seconds)
- assert_delivery(correlation_id, received_message) → pass/fail + latency
- report_result(phase, app_id, passed, latency_ms, details)
- check_queue_depth(qm_name, queue_name) → current depth
- check_channel_status(qm_name, channel_name) → RUNNING/STOPPED/etc
- log_audit_event(operation, qm_target, agent, result)

## Validation protocol
For each application queue pair (e.g. Q.APP1.REQUEST.LOCAL):
1. Generate a unique correlation_id (UUID)
2. PUT test message to the SOURCE of the flow:
   - BASELINE: PUT to source QM queue directly
   - POST_REWIRE: PUT to source QM queue (which now routes via remote def)
   - FINAL: PUT to target QM queue directly
3. GET the message from the DESTINATION queue with 5-second timeout
4. assert_delivery to compare correlation IDs and measure latency
5. check_queue_depth to confirm no stuck messages
6. If channel involved: check_channel_status to confirm RUNNING

## Pass criteria
- Message received within 5000 ms
- Correlation ID matches
- No duplicate messages (queue depth returns to 0)
- Channel status is RUNNING (when applicable)

## Failure criteria
- Message not received within 5 seconds
- Correlation ID mismatch
- Queue depth non-zero after GET (messages stuck)
- Channel in ERROR or STOPPED state

## Response format
{
  "phase": "BASELINE" | "POST_REWIRE" | "FINAL",
  "app_id": "<id>",
  "passed": true | false,
  "latency_ms": <number>,
  "queue_tested": "<name>",
  "source_qm": "<name>",
  "dest_qm": "<name>",
  "details": "<description>",
  "error": null | "<description>"
}
"""

def build_validation_agent() -> Agent:
    return Agent(
        name="validation_agent",
        model=GEMINI_MODEL,
        instruction=VALIDATION_INSTRUCTION,
        tools=[
            put_test_message,
            get_test_message,
            assert_delivery,
            report_result,
            check_queue_depth,
            check_channel_status,
            log_audit_event,
        ],
    )
```

---

### 8.2 Validation Tools

```python
# agents/tools/validation_tools.py
import asyncio
import time
import uuid
import structlog
from typing import Optional

log = structlog.get_logger()

async def put_test_message(qm_name: str, queue_name: str,
                            message_body: str,
                            correlation_id: Optional[str] = None) -> dict:
    """PUT a test message to a queue. Returns message ID and correlation ID."""
    from mq.registry import get_registry
    registry = get_registry()
    qm = registry.get(qm_name)

    corr_id = correlation_id or str(uuid.uuid4()).replace("-", "")[:24]
    test_body = f"VALIDATION_TEST|{corr_id}|{message_body}|{time.time()}"

    msg_id = await qm.client.put_message(
        qm.internal_name, queue_name, test_body, corr_id
    )

    log.info("validation_put", qm=qm_name, queue=queue_name,
             corr_id=corr_id, msg_id=msg_id)

    return {
        "status": "put",
        "qm": qm_name,
        "queue": queue_name,
        "correlation_id": corr_id,
        "msg_id": msg_id,
        "sent_at": time.time(),
    }

async def get_test_message(qm_name: str, queue_name: str,
                            correlation_id: str,
                            timeout_seconds: int = 5) -> dict:
    """
    Attempt to GET a message by correlation ID.
    Polls for up to timeout_seconds.
    """
    from mq.registry import get_registry
    registry = get_registry()
    qm = registry.get(qm_name)

    start = time.monotonic()
    deadline = start + timeout_seconds

    while time.monotonic() < deadline:
        body = await qm.client.get_message(
            qm.internal_name, queue_name, correlation_id
        )
        if body is not None:
            latency_ms = (time.monotonic() - start) * 1000
            log.info("validation_get", qm=qm_name, queue=queue_name,
                     corr_id=correlation_id, latency_ms=round(latency_ms, 2))
            return {
                "status": "received",
                "body": body,
                "correlation_id": correlation_id,
                "latency_ms": round(latency_ms, 2),
                "received_at": time.time(),
            }
        await asyncio.sleep(0.5)

    elapsed = (time.monotonic() - start) * 1000
    log.warning("validation_timeout", qm=qm_name, queue=queue_name,
                corr_id=correlation_id, elapsed_ms=round(elapsed, 2))
    return {
        "status": "timeout",
        "body": None,
        "correlation_id": correlation_id,
        "latency_ms": round(elapsed, 2),
        "error": f"No message received within {timeout_seconds}s",
    }

async def assert_delivery(correlation_id: str,
                           received_result: dict) -> dict:
    """
    Assert that a message was delivered correctly.
    Returns pass/fail + latency.
    """
    if received_result["status"] == "timeout":
        return {
            "passed": False,
            "correlation_id": correlation_id,
            "latency_ms": received_result["latency_ms"],
            "reason": "TIMEOUT",
        }

    # Verify body contains the correlation ID
    body = received_result.get("body", "")
    if correlation_id not in body:
        return {
            "passed": False,
            "correlation_id": correlation_id,
            "latency_ms": received_result["latency_ms"],
            "reason": "CORRELATION_ID_MISMATCH",
        }

    return {
        "passed": True,
        "correlation_id": correlation_id,
        "latency_ms": received_result["latency_ms"],
        "reason": "DELIVERED",
    }

async def report_result(phase: str, app_id: str, passed: bool,
                         latency_ms: float, details: str = "") -> dict:
    """Persist validation result to Redis and emit audit event."""
    from state.redis_store import RedisStore
    store = RedisStore()

    result = {
        "phase": phase,
        "app_id": app_id,
        "passed": passed,
        "latency_ms": latency_ms,
        "details": details,
        "timestamp": time.time(),
    }

    r = await store._get_redis()
    await r.lpush(f"validation:{app_id}", __import__("json").dumps(result))
    await r.ltrim(f"validation:{app_id}", 0, 99)  # Keep last 100

    await store.append_audit({
        "operation": "VALIDATION",
        "agent": "validation_agent",
        "app_id": app_id,
        "phase": phase,
        "result": "PASS" if passed else "FAIL",
        "latency_ms": latency_ms,
    })

    return result

async def check_queue_depth(qm_name: str, queue_name: str) -> dict:
    """Check current queue depth."""
    from mq.registry import get_registry
    registry = get_registry()
    qm = registry.get(qm_name)

    r = await qm.client.client.get(
        f"{qm.svc_url}/ibmmq/rest/v2/admin/qmgr"
        f"/{qm.internal_name}/queue/{queue_name}",
        auth=qm.client.auth,
        params={"status": "status"}
    )
    r.raise_for_status()
    data = r.json()
    depth = data.get("queue", [{}])[0].get("status", {}).get("currentDepth", -1)

    return {
        "qm": qm_name,
        "queue": queue_name,
        "current_depth": depth,
        "is_empty": depth == 0,
    }

async def check_channel_status(qm_name: str, channel_name: str) -> dict:
    """Check channel status."""
    from mq.registry import get_registry
    registry = get_registry()
    qm = registry.get(qm_name)

    r = await qm.client.client.get(
        f"{qm.svc_url}/ibmmq/rest/v2/admin/qmgr"
        f"/{qm.internal_name}/channel/{channel_name}",
        auth=qm.client.auth,
        params={"status": "status"}
    )
    r.raise_for_status()
    data = r.json()
    status = data.get("channel", [{}])[0].get("status", {}).get("status", "UNKNOWN")

    return {
        "qm": qm_name,
        "channel": channel_name,
        "status": status,
        "running": status == "RUNNING",
    }
```

---

## Validation Matrix

For each of the 6 applications, 3 phases, 2 queues (REQUEST + RESPONSE):

| App | Phase | Queue | Source QM | Dest QM | Expected |
|-----|-------|-------|-----------|---------|----------|
| APP1 | BASELINE | Q.APP1.REQUEST.LOCAL | QM.SRC.A | QM.SRC.A | PASS |
| APP1 | POST_REWIRE | Q.APP1.REQUEST.LOCAL | QM.SRC.A | QM.APP1 | PASS |
| APP1 | FINAL | Q.APP1.REQUEST.LOCAL | QM.APP1 | QM.APP1 | PASS |
| APP2–6 | Same pattern | ... | ... | ... | ... |

---

## Validation Evidence Format

Each migration step produces a validation evidence record:

```json
{
  "migration_step": "APP1 QM.SRC.A → QM.APP1",
  "validation_results": {
    "BASELINE": {
      "passed": true,
      "latency_ms": 42,
      "queue": "Q.APP1.REQUEST.LOCAL",
      "timestamp": "2025-05-04T10:00:00Z"
    },
    "POST_REWIRE": {
      "passed": true,
      "latency_ms": 156,
      "queue": "Q.APP1.REQUEST.LOCAL",
      "timestamp": "2025-05-04T10:02:30Z",
      "note": "Routed via CHL.SRCA.APP1 transmission channel"
    },
    "FINAL": {
      "passed": true,
      "latency_ms": 38,
      "queue": "Q.APP1.REQUEST.LOCAL",
      "timestamp": "2025-05-04T10:04:15Z"
    }
  },
  "overall": "PASSED",
  "producer_unchanged": true
}
```

---

## BCL Validation Endpoint

```python
# bcl/routers/validation.py
from fastapi import APIRouter
from pydantic import BaseModel
from state.redis_store import RedisStore
import json

router = APIRouter(tags=["validation"])

class ValidateRequest(BaseModel):
    app_id: str
    qm_name: str
    queue_name: str
    phase: str  # BASELINE | POST_REWIRE | FINAL

@router.post("/validate")
async def run_validation(req: ValidateRequest):
    from agents.validation_agent import build_validation_agent
    from google.adk.runners import Runner
    from agents.base import get_session_service, APP_ID

    agent = build_validation_agent()
    runner = Runner(agent=agent, app_name=APP_ID,
                    session_service=get_session_service())
    session_service = get_session_service()
    session = await session_service.create_session(
        app_name=APP_ID, user_id=req.app_id
    )

    prompt = (
        f"Run {req.phase} validation for {req.app_id}. "
        f"Test queue {req.queue_name} on {req.qm_name}. "
        f"Return JSON validation result."
    )

    result_text = ""
    async for event in runner.run_async(
        session_id=session.id, user_id=req.app_id, new_message=prompt
    ):
        if event.is_final_response():
            result_text = event.content.parts[0].text

    return json.loads(result_text)

@router.get("/validate/{app_id}/history")
async def get_validation_history(app_id: str):
    store = RedisStore()
    r = await store._get_redis()
    raw = await r.lrange(f"validation:{app_id}", 0, -1)
    return {
        "app_id": app_id,
        "results": [json.loads(item) for item in raw]
    }
```

---

## Success Criteria

| Criterion | Verification |
|-----------|-------------|
| Baseline validation confirms source flows | All 6 apps return PASS before migration |
| Post-rewire validation confirms transparent routing | Messages arrive at target QM |
| Final validation confirms cutover complete | Direct target QM flow passes |
| Timeout after 5s triggers fail + rollback | Test with queue that doesn't exist |
| Validation results persisted in Redis | `GET /api/validate/{app_id}/history` |
| Evidence JSON generated per migration step | Shown in UI validation panel |
