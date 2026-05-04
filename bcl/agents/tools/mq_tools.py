"""
Thin async functions called as ADK tool callbacks.
Each function calls the BCL's internal MQ client directly (same process)
to avoid HTTP round-trips.
"""
import structlog
from bcl.mq.registry import get_registry
from bcl.policy.engine import enforce_pre_operation

log = structlog.get_logger()


async def create_queue_manager(qm_logical_name: str, zone: str, app_id: str) -> dict:
    """Create a new queue manager pod on OCP and register it in the BCL fleet."""
    from bcl.mq.registry import QueueManagerEntry
    from bcl.mq.client import MQRestClient
    import os

    svc_url = f"https://{qm_logical_name.lower().replace('.', '-')}-svc:9443"

    registry = get_registry()
    registry.register(QueueManagerEntry(
        name=qm_logical_name,
        internal_name=qm_logical_name.replace(".", "")[:48],
        svc_url=svc_url,
        role="target",
        client=MQRestClient(svc_url, "admin", os.environ.get("MQ_ADMIN_PASSWORD", "passw0rd")),
    ))
    log.info("tool_create_qm", qm=qm_logical_name, zone=zone, app=app_id)
    return {"status": "created", "qm": qm_logical_name, "svc_url": svc_url}


async def create_queue(
    qm_name: str, queue_name: str, queue_type: str = "LOCAL", props: dict = None
) -> dict:
    """Create a queue on the specified QM via MQ REST API."""
    props = props or {}
    await enforce_pre_operation(
        {"type": "create_queue", "object_type": "queue", "name": queue_name, **props},
        qm_name,
    )
    registry = get_registry()
    qm = registry.get(qm_name)
    await qm.client.create_queue(qm.internal_name, queue_name, {"type": queue_type, **props})
    log.info("tool_create_queue", qm=qm_name, queue=queue_name, type=queue_type)
    return {"status": "created", "queue": queue_name, "qm": qm_name}


async def set_dlq(qm_name: str, dlq_name: str) -> dict:
    """Create the Dead Letter Queue and set it as the QM's DLQ."""
    await create_queue(qm_name, dlq_name, "LOCAL", {"description": "Dead Letter Queue"})
    registry = get_registry()
    qm = registry.get(qm_name)
    r = await qm.client._get_client().patch(
        f"{qm.svc_url}/ibmmq/rest/v2/admin/qmgr/{qm.internal_name}",
        json={"deadLetterQueue": dlq_name},
        headers={"ibm-mq-rest-csrf-token": "blank"},
    )
    r.raise_for_status()
    log.info("tool_set_dlq", qm=qm_name, dlq=dlq_name)
    return {"status": "dlq_set", "qm": qm_name, "dlq": dlq_name}


async def create_channel(
    qm_name: str, channel_name: str, channel_type: str, props: dict = None
) -> dict:
    """Create a channel on the specified QM."""
    props = props or {}
    await enforce_pre_operation(
        {
            "type": "create_channel",
            "object_type": "channel",
            "name": channel_name,
            "channel_type": channel_type,
            **props,
        },
        qm_name,
    )
    registry = get_registry()
    qm = registry.get(qm_name)
    await qm.client.create_channel(qm.internal_name, channel_name, {"type": channel_type, **props})
    log.info("tool_create_channel", qm=qm_name, channel=channel_name)
    return {"status": "created", "channel": channel_name, "qm": qm_name}


async def create_xmit_queue(source_qm: str, xmit_queue_name: str, target_qm: str) -> dict:
    """Create a transmission queue on the source QM for routing to the target QM."""
    return await create_queue(
        source_qm,
        xmit_queue_name,
        "LOCAL",
        {
            "usage": "XMITQ",
            "description": f"Transmission queue to {target_qm}",
            "triggerControl": "TRIGGER",
            "triggerType": "FIRST",
        },
    )


async def create_remote_def(
    source_qm: str,
    remote_queue_name: str,
    remote_q_name: str,
    remote_qm_name: str,
    xmit_queue: str,
) -> dict:
    """Create a remote queue definition for transparent rewiring."""
    await enforce_pre_operation(
        {"type": "create_queue", "object_type": "queue", "name": remote_queue_name},
        source_qm,
    )
    registry = get_registry()
    qm = registry.get(source_qm)
    await qm.client.create_queue(
        qm.internal_name,
        remote_queue_name,
        {
            "type": "REMOTE",
            "remoteQName": remote_q_name,
            "remoteQMgrName": remote_qm_name,
            "xmitQName": xmit_queue,
        },
    )
    log.info(
        "tool_create_remote_def",
        source_qm=source_qm,
        remote_def=remote_queue_name,
        target_qm=remote_qm_name,
    )
    return {"status": "created", "remote_def": remote_queue_name}
