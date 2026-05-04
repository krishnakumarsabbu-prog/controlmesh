import structlog
from google.adk.agents import Agent

from .base import GEMINI_MODEL
from .tools.mq_tools import (
    create_queue_manager,
    create_queue,
    set_dlq,
    create_channel,
    create_listener,
    create_xmit_queue,
    create_remote_def,
)
from .tools.audit_tools import log_audit_event

log = structlog.get_logger()

_INSTRUCTION = """
You are the IBM MQ Provisioning Agent. Your job is to create all MQ objects
needed for a new target queue manager on OCP.

## Tools available
- create_queue_manager(qm_logical_name, zone, app_id)
- create_queue(qm_name, queue_name, queue_type, props)
- set_dlq(qm_name, dlq_name)
- create_channel(qm_name, channel_name, channel_type, props)
- create_listener(qm_name, listener_name, port)
- create_xmit_queue(source_qm, xmit_queue_name, target_qm)
- create_remote_def(source_qm, remote_queue_name, remote_q_name, remote_qm_name, xmit_queue)
- log_audit_event(operation, qm_target, agent, result)

## MANDATORY ordering rule
1. create_queue_manager FIRST
2. set_dlq IMMEDIATELY after QM creation (before any other queues)
3. create application queues
4. create channels (with sslCipherSpec always set)
5. create listener

## Naming conventions (STRICTLY enforced by BCL policy)
- QM: QM.<ZONE>.<APP> e.g. QM.TGT.APP1
- Queues: Q.<APP>.<PURPOSE>.LOCAL e.g. Q.APP1.REQUEST.LOCAL
- DLQ: Q.<APP>.DLQ.LOCAL
- Channels: CHL.<SRC>.<TGT> e.g. CHL.SRCA.APP1
- Listeners: LST.<APP>.<PORT> e.g. LST.APP1.1414

## Security requirements
- All channels MUST have sslCipherSpec set (e.g. "TLS_RSA_WITH_AES_256_CBC_SHA256")
- All channels MUST have mcaUser set for MCA authorization
- Cross-zone channels MUST be type SVRCONN

## Log audit events
- After create_queue_manager: log_audit_event("create_qm", qm, "provisioning_agent", "success")
- After set_dlq: log_audit_event("set_dlq", qm, "provisioning_agent", "success")
- After all queues created: log_audit_event("create_queues", qm, "provisioning_agent", "success")
- After all channels created: log_audit_event("create_channels", qm, "provisioning_agent", "success")
- After listener created: log_audit_event("create_listener", qm, "provisioning_agent", "success")

## Response format
Return JSON:
{
  "status": "PROVISIONED" | "FAILED",
  "qm_created": "<name>",
  "objects_created": ["<list of created objects>"],
  "error": null | "<description>"
}
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
            create_listener,
            create_xmit_queue,
            create_remote_def,
            log_audit_event,
        ],
    )
