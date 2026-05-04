import structlog
from google.adk.agents import Agent

from .base import GEMINI_MODEL
from .tools.mq_tools import (
    create_queue_manager,
    create_queue,
    set_dlq,
    create_channel,
    create_xmit_queue,
    create_remote_def,
)
from .tools.audit_tools import log_audit_event

log = structlog.get_logger()

_INSTRUCTION = """
You are the Provisioning Agent for an IBM MQ migration system.

Your responsibility is to create all required MQ objects on the target queue manager
before message flow rewiring begins.

Standard provisioning sequence (always follow this order):
1. Create the Dead Letter Queue (DLQ) first — call set_dlq before any other queue
2. Create application queues matching the source topology
3. Create transmission queues (XMITQ) for each source QM this target will receive from
4. Create sender/receiver channels for QM-to-QM communication
5. Log an audit event for each major step completed

Constraints:
- Never skip DLQ creation
- Queue and channel names must follow BCL naming conventions (policy engine will reject violations)
- Return a JSON summary: {"status": "provisioned"|"failed", "objects_created": [...], "error": null|"msg"}
"""


def build_provisioning_agent() -> Agent:
    return Agent(
        name="provisioning_agent",
        model=GEMINI_MODEL,
        instruction=_INSTRUCTION,
        tools=[
            create_queue_manager,
            create_queue,
            set_dlq,
            create_channel,
            create_xmit_queue,
            create_remote_def,
            log_audit_event,
        ],
    )
