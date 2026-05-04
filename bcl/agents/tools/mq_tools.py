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
    """Deploy a new MQ QM pod on OCP and register it in the BCL fleet."""
    from bcl.mq.registry import QueueManagerEntry
    from bcl.mq.client import MQRestClient
    from bcl.ocp.deployer import deploy_qm_pod
    import os

    await deploy_qm_pod(qm_logical_name, zone, app_id)

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


async def create_listener(qm_name: str, listener_name: str, port: int) -> dict:
    """Create a listener on the specified QM via MQ REST API."""
    from bcl.policy.naming import validate_naming

    errors = validate_naming({"object_type": "listener", "name": listener_name})
    if errors:
        return {"status": "error", "violations": errors}

    registry = get_registry()
    qm = registry.get(qm_name)
    r = await qm.client._get_client().post(
        f"{qm.svc_url}/ibmmq/rest/v2/admin/qmgr/{qm.internal_name}/listener",
        json={"name": listener_name, "port": port, "transport": "TCP"},
        auth=qm.client.auth,
        headers={"ibm-mq-rest-csrf-token": "blank"},
    )
    r.raise_for_status()
    log.info("tool_create_listener", qm=qm_name, listener=listener_name, port=port)
    return {"status": "created", "listener": listener_name, "port": port, "qm": qm_name}


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


async def diff_topology(source_qm: str, target_qm: str, app_id: str) -> dict:
    """Compare source and target topology to determine what needs to move."""
    import httpx

    registry = get_registry()
    source_entry = registry.get(source_qm)

    r = await source_entry.client._get_client().get(
        f"{source_entry.svc_url}/ibmmq/rest/v2/admin/qmgr"
        f"/{source_entry.internal_name}/queue",
        auth=source_entry.client.auth,
        params={"name": f"Q.{app_id}.*"},
    )
    r.raise_for_status()
    source_queues = [q["name"] for q in r.json().get("queue", [])]

    target_queues: list = []
    try:
        target_entry = registry.get(target_qm)
        r2 = await target_entry.client._get_client().get(
            f"{target_entry.svc_url}/ibmmq/rest/v2/admin/qmgr"
            f"/{target_entry.internal_name}/queue",
            auth=target_entry.client.auth,
            params={"name": f"Q.{app_id}.*"},
        )
        if r2.status_code == 200:
            target_queues = [q["name"] for q in r2.json().get("queue", [])]
    except KeyError:
        pass  # Target QM not yet created — all queues need to move

    queues_to_move = [
        q for q in source_queues if q not in target_queues and "DLQ" not in q
    ]

    log.info(
        "tool_diff_topology",
        source_qm=source_qm,
        target_qm=target_qm,
        app_id=app_id,
        to_move=len(queues_to_move),
    )
    return {
        "app_id": app_id,
        "source_qm": source_qm,
        "target_qm": target_qm,
        "queues_on_source": source_queues,
        "queues_on_target": target_queues,
        "queues_to_move": queues_to_move,
        "action_required": len(queues_to_move) > 0,
    }


async def create_sender_channel(
    source_qm: str, channel_name: str, target_host: str, target_port: int = 1414
) -> dict:
    """Create SDR (sender) channel on source QM pointing at target QM listener."""
    await enforce_pre_operation(
        {
            "type": "create_channel",
            "object_type": "channel",
            "name": channel_name,
            "channel_type": "SDR",
            "ssl_cipher_spec": "TLS_RSA_WITH_AES_256_CBC_SHA256",
            "cross_region": False,
        },
        source_qm,
    )
    registry = get_registry()
    qm = registry.get(source_qm)

    # Derive the xmit queue name from channel name convention CHL.<SRC>.<APP>
    # → Q.<SRC>.<APP>.XMIT.XMIT
    parts = channel_name.split(".")  # e.g. ["CHL", "SRCA", "APP1"]
    xmit_suffix = ".".join(parts[1:]) if len(parts) >= 3 else channel_name
    xmit_name = f"Q.{xmit_suffix}.XMIT.XMIT"

    await qm.client.create_channel(
        qm.internal_name,
        channel_name,
        {
            "type": "SDR",
            "connectionName": f"{target_host}({target_port})",
            "xmitQName": xmit_name,
            "sslCipherSpec": "TLS_RSA_WITH_AES_256_CBC_SHA256",
        },
    )
    log.info("tool_create_sender_channel", qm=source_qm, channel=channel_name, target=target_host)
    return {"status": "created", "channel": channel_name, "type": "SDR", "qm": source_qm}


async def create_receiver_channel(target_qm: str, channel_name: str) -> dict:
    """Create RCVR (receiver) channel on target QM."""
    await enforce_pre_operation(
        {
            "type": "create_channel",
            "object_type": "channel",
            "name": channel_name,
            "channel_type": "RCVR",
            "ssl_cipher_spec": "TLS_RSA_WITH_AES_256_CBC_SHA256",
        },
        target_qm,
    )
    registry = get_registry()
    qm = registry.get(target_qm)
    await qm.client.create_channel(
        qm.internal_name,
        channel_name,
        {
            "type": "RCVR",
            "sslCipherSpec": "TLS_RSA_WITH_AES_256_CBC_SHA256",
            "mcaUser": "mqm",
        },
    )
    log.info("tool_create_receiver_channel", qm=target_qm, channel=channel_name)
    return {"status": "created", "channel": channel_name, "type": "RCVR", "qm": target_qm}


async def start_channel(qm_name: str, channel_name: str) -> dict:
    """Start a channel (initiate connection)."""
    registry = get_registry()
    qm = registry.get(qm_name)
    r = await qm.client._get_client().post(
        f"{qm.svc_url}/ibmmq/rest/v2/admin/action/qmgr"
        f"/{qm.internal_name}/channel/{channel_name}/start",
        auth=qm.client.auth,
        headers={"ibm-mq-rest-csrf-token": "blank"},
    )
    r.raise_for_status()
    log.info("tool_start_channel", qm=qm_name, channel=channel_name)
    return {"status": "started", "channel": channel_name, "qm": qm_name}


async def move_consumer(app_id: str, from_qm: str, to_qm: str) -> dict:
    """
    Update the consumer application's MQ connection binding in Redis.
    In a production system this would update a ConfigMap or environment variable.
    """
    import datetime
    from bcl.state.redis_store import RedisStore

    store = RedisStore()
    r = await store._get_redis()
    await r.hset(
        f"consumer:{app_id}",
        mapping={
            "qm": to_qm,
            "migrated_at": str(datetime.datetime.utcnow()),
        },
    )
    log.info("tool_move_consumer", app_id=app_id, from_qm=from_qm, to_qm=to_qm)
    return {"status": "consumer_moved", "app_id": app_id, "from_qm": from_qm, "to_qm": to_qm}


async def delete_local_queue(qm_name: str, queue_name: str) -> dict:
    """Remove a local queue from a QM (used during cutover)."""
    registry = get_registry()
    qm = registry.get(qm_name)
    await qm.client.delete_queue(qm.internal_name, queue_name)
    log.info("tool_delete_local_queue", qm=qm_name, queue=queue_name)
    return {"status": "deleted", "queue": queue_name, "qm": qm_name}


async def delete_xmit_queue(qm_name: str, xmit_queue_name: str) -> dict:
    """Remove transmission queue from source QM after migration is confirmed."""
    return await delete_local_queue(qm_name, xmit_queue_name)


async def delete_remote_def(qm_name: str, remote_def_name: str) -> dict:
    """Remove remote queue definition from source QM after migration is confirmed."""
    return await delete_local_queue(qm_name, remote_def_name)


async def scan_drift(qm_name: str) -> list[dict]:
    """Scan a queue manager for manual configuration changes (Drift)."""
    registry = get_registry()
    qm = registry.get(qm_name)
    
    issues = []
    # Mock check for MAXDEPTH drift
    # In reality, this would query the MQ REST API and compare with the BCL's source of truth
    if qm_name == "QM.APP1":
        issues.append({
            "id": "drift-001",
            "qm": qm_name,
            "object_type": "QUEUE",
            "object_name": "Q.APP1.REQUEST.LOCAL",
            "issue": "MAXDEPTH modified from 5000 to 100000",
            "expected": "5000",
            "actual": "100000",
            "severity": "MEDIUM"
        })
    
    # Mock check for SSL Cipher drift
    if qm_name == "QM.SRC.A":
        issues.append({
            "id": "drift-002",
            "qm": qm_name,
            "object_type": "CHANNEL",
            "object_name": "CHL.SRCA.SRCB",
            "issue": "SSLCIPH changed manually to NULL_SHA",
            "expected": "TLS_RSA_WITH_AES_256_CBC_SHA256",
            "actual": "NULL_SHA",
            "severity": "CRITICAL"
        })
        
    return issues


async def heal_drift(issue_id: str, qm_name: str, object_type: str, object_name: str, expected_value: str) -> dict:
    """Revert a drifted object to its expected enterprise standard configuration."""
    registry = get_registry()
    qm = registry.get(qm_name)
    
    log.info("tool_heal_drift", issue_id=issue_id, qm=qm_name, obj=object_name)
    
    # In reality, this would call the appropriate 'update' method on the MQ client
    # to re-apply the enterprise standard value.
    if object_type == "QUEUE":
        await qm.client.create_queue(qm.internal_name, object_name, {"maxDepth": int(expected_value)})
    elif object_type == "CHANNEL":
        await qm.client.create_channel(qm.internal_name, object_name, {"sslCipherSpec": expected_value})
        
    return {"status": "healed", "issue_id": issue_id, "object": object_name}
