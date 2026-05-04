import structlog
from google.adk.agents import Agent

from .base import GEMINI_MODEL
from .tools.redis_tools import load_snapshot
from .tools.audit_tools import log_audit_event

log = structlog.get_logger()


async def delete_queue(qm_name: str, queue_name: str) -> dict:
    """Delete a queue from the specified QM."""
    from bcl.mq.registry import get_registry

    registry = get_registry()
    qm = registry.get(qm_name)
    if qm is None:
        return {"error": f"QM {qm_name} not in registry"}
    try:
        await qm.client.delete_queue(qm.internal_name, queue_name)
        log.info("tool_delete_queue", qm=qm_name, queue=queue_name)
        return {"status": "deleted", "queue": queue_name, "qm": qm_name}
    except Exception as exc:
        return {"error": str(exc), "queue": queue_name}


async def delete_channel(qm_name: str, channel_name: str) -> dict:
    """Delete a channel from the specified QM."""
    from bcl.mq.registry import get_registry

    registry = get_registry()
    qm = registry.get(qm_name)
    if qm is None:
        return {"error": f"QM {qm_name} not in registry"}
    try:
        await qm.client.delete_channel(qm.internal_name, channel_name)
        log.info("tool_delete_channel", qm=qm_name, channel=channel_name)
        return {"status": "deleted", "channel": channel_name, "qm": qm_name}
    except Exception as exc:
        return {"error": str(exc), "channel": channel_name}


_INSTRUCTION = """
You are the Rollback Agent for an IBM MQ migration system.

Your responsibility is to restore the pre-migration MQ topology when a migration
fails or is explicitly rolled back.

Rollback sequence:
1. Load the pre-migration snapshot from Redis
2. Compare current state against the snapshot to identify objects created during migration
3. Delete remote queue definitions added on the source QM (restores direct local delivery)
4. Delete sender/receiver channels created for migration
5. Leave target QM objects in place (they are harmless and may be reused)
6. Log an audit event for each deletion and the overall rollback outcome

Return a JSON summary:
{
  "status": "rolled_back"|"partial"|"failed",
  "objects_removed": [...],
  "snapshot_restored": true|false,
  "error": null|"description"
}
"""


def build_rollback_agent() -> Agent:
    return Agent(
        name="rollback_agent",
        model=GEMINI_MODEL,
        instruction=_INSTRUCTION,
        tools=[
            load_snapshot,
            delete_queue,
            delete_channel,
            log_audit_event,
        ],
    )
