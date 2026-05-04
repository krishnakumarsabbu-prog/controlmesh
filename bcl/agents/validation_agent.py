import structlog
from google.adk.agents import Agent

from .base import GEMINI_MODEL
from .tools.audit_tools import log_audit_event

log = structlog.get_logger()


async def test_queue_depth(qm_name: str, queue_name: str) -> dict:
    """Return the current depth of a queue on the specified QM."""
    from bcl.mq.registry import get_registry

    registry = get_registry()
    qm = registry.get(qm_name)
    if qm is None:
        return {"error": f"QM {qm_name} not found in registry"}
    try:
        queues_data = await qm.client.list_queues(qm.internal_name)
        queues = queues_data.get("queue", [])
        for q in queues:
            if q.get("name") == queue_name:
                return {"qm": qm_name, "queue": queue_name, "depth": q.get("currentDepth", 0)}
        return {"qm": qm_name, "queue": queue_name, "depth": 0, "note": "queue not found"}
    except Exception as exc:
        return {"error": str(exc)}


async def send_probe_message(qm_name: str, queue_name: str, payload: str) -> dict:
    """Send a probe message to a queue and return the correlation ID."""
    from bcl.mq.registry import get_registry

    registry = get_registry()
    qm = registry.get(qm_name)
    if qm is None:
        return {"error": f"QM {qm_name} not found in registry"}
    try:
        correlation_id = await qm.client.put_message(qm.internal_name, queue_name, payload)
        return {"sent": True, "correlation_id": correlation_id, "qm": qm_name, "queue": queue_name}
    except Exception as exc:
        return {"error": str(exc)}


async def receive_probe_message(qm_name: str, queue_name: str, correlation_id: str) -> dict:
    """Attempt to receive a probe message by correlation ID."""
    from bcl.mq.registry import get_registry

    registry = get_registry()
    qm = registry.get(qm_name)
    if qm is None:
        return {"error": f"QM {qm_name} not found in registry"}
    try:
        body = await qm.client.get_message(qm.internal_name, queue_name, correlation_id)
        return {"received": body is not None, "body": body, "qm": qm_name, "queue": queue_name}
    except Exception as exc:
        return {"error": str(exc)}


async def check_qm_reachable(qm_name: str) -> dict:
    """Check whether a queue manager is reachable via the MQ REST API."""
    from bcl.mq.registry import get_registry

    registry = get_registry()
    qm = registry.get(qm_name)
    if qm is None:
        return {"reachable": False, "reason": f"QM {qm_name} not in registry"}
    try:
        await qm.client.get_qmgr_status()
        return {"reachable": True, "qm": qm_name}
    except Exception as exc:
        return {"reachable": False, "qm": qm_name, "reason": str(exc)}


_INSTRUCTION = """
You are the Validation Agent for an IBM MQ migration system.

Your responsibility is to verify that message flows work correctly at each stage
of the migration (baseline, post-rewire, post-cutover).

Validation sequence:
1. Check both source and target QMs are reachable
2. Send a probe message to the relevant queue on the source QM
3. Verify the probe message arrives on the target QM (post-rewire) or stays local (baseline)
4. Check queue depths are as expected (no stuck messages)
5. Log audit events with validation outcome

Return a JSON result:
{
  "passed": true|false,
  "phase": "baseline"|"post_rewire"|"post_cutover",
  "checks": [{"name": "...", "passed": true|false, "detail": "..."}],
  "error": null|"description"
}
"""


def build_validation_agent() -> Agent:
    return Agent(
        name="validation_agent",
        model=GEMINI_MODEL,
        instruction=_INSTRUCTION,
        tools=[
            check_qm_reachable,
            test_queue_depth,
            send_probe_message,
            receive_probe_message,
            log_audit_event,
        ],
    )
