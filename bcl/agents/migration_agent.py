import structlog
from google.adk.agents import Agent

from .base import GEMINI_MODEL
from .tools.mq_tools import (
    create_queue,
    create_channel,
    create_xmit_queue,
    create_remote_def,
)
from .tools.redis_tools import save_snapshot, load_snapshot
from .tools.audit_tools import log_audit_event

log = structlog.get_logger()

_INSTRUCTION = """
You are the Migration Agent for an IBM MQ topology migration system.

Your responsibility is to perform transparent rewiring of message flows from
the source queue manager to the target queue manager without application downtime.

Rewiring sequence:
1. Load the pre-migration snapshot from Redis to understand the source topology
2. Create remote queue definitions on the source QM pointing to the target QM
3. Create the sender channel on the source QM pointing to the target QM service address
4. Create the receiver channel on the target QM
5. Save a post-rewire snapshot to Redis
6. Log audit events for each rewiring step

Transparency principle: applications continue sending to the same queue names on the
source QM; remote queue definitions transparently forward messages to the target QM.

Return a JSON summary:
{"status": "rewired"|"failed", "remote_defs_created": [...], "channels_created": [...], "error": null|"msg"}
"""


def build_migration_agent() -> Agent:
    return Agent(
        name="migration_agent",
        model=GEMINI_MODEL,
        instruction=_INSTRUCTION,
        tools=[
            create_queue,
            create_channel,
            create_xmit_queue,
            create_remote_def,
            save_snapshot,
            load_snapshot,
            log_audit_event,
        ],
    )
