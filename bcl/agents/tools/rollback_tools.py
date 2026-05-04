"""
Idempotent rollback tools for the Rollback Agent.
Every delete/stop operation returns success even if the object is already absent.
"""
import time
import uuid
from typing import Optional

import structlog

log = structlog.get_logger()


async def load_snapshot(app_id: str) -> dict:
    """Load the pre-migration topology snapshot from Redis."""
    from bcl.state.redis_store import RedisStore

    store = RedisStore()
    snapshot = await store.load_latest_snapshot(app_id)
    if snapshot is None:
        log.warning("rollback_no_snapshot", app_id=app_id)
        return {"error": f"No snapshot found for {app_id}", "snapshot": None}
    log.info("rollback_snapshot_loaded", app_id=app_id)
    return {"snapshot": snapshot, "app_id": app_id}


async def delete_remote_def_safe(qm_name: str, remote_def_name: str) -> dict:
    """Delete a remote queue definition. Returns success even if not found."""
    from bcl.mq.registry import get_registry

    registry = get_registry()
    qm = registry.get(qm_name)
    if qm is None:
        return {"status": "error", "error": f"QM {qm_name} not in registry", "object": remote_def_name}
    try:
        await qm.client.delete_queue(qm.internal_name, remote_def_name)
        log.info("rollback_deleted_remote_def", qm=qm_name, name=remote_def_name)
        return {"status": "deleted", "object": remote_def_name, "qm": qm_name}
    except Exception as exc:
        err = str(exc)
        if any(k in err for k in ("MQRC_UNKNOWN_OBJECT_NAME", "404", "UNKNOWN_OBJECT", "not found")):
            log.info("rollback_remote_def_already_absent", qm=qm_name, name=remote_def_name)
            return {"status": "already_absent", "object": remote_def_name, "qm": qm_name}
        log.warning("rollback_delete_remote_def_error", qm=qm_name, name=remote_def_name, error=err)
        return {"status": "error", "error": err, "object": remote_def_name}


async def delete_xmit_queue_safe(qm_name: str, xmit_queue_name: str) -> dict:
    """Delete xmit queue. Returns success if not found."""
    from bcl.mq.registry import get_registry

    registry = get_registry()
    qm = registry.get(qm_name)
    if qm is None:
        return {"status": "error", "error": f"QM {qm_name} not in registry", "object": xmit_queue_name}
    try:
        await qm.client.delete_queue(qm.internal_name, xmit_queue_name)
        log.info("rollback_deleted_xmit_queue", qm=qm_name, name=xmit_queue_name)
        return {"status": "deleted", "object": xmit_queue_name, "qm": qm_name}
    except Exception as exc:
        err = str(exc)
        if any(k in err for k in ("404", "UNKNOWN_OBJECT", "MQRC_UNKNOWN_OBJECT_NAME", "not found")):
            return {"status": "already_absent", "object": xmit_queue_name, "qm": qm_name}
        log.warning("rollback_delete_xmit_error", qm=qm_name, name=xmit_queue_name, error=err)
        return {"status": "error", "error": err, "object": xmit_queue_name}


async def stop_channel_safe(qm_name: str, channel_name: str) -> dict:
    """Stop a channel. Safe to call if already stopped or absent."""
    from bcl.mq.registry import get_registry

    registry = get_registry()
    qm = registry.get(qm_name)
    if qm is None:
        return {"status": "error", "error": f"QM {qm_name} not in registry", "channel": channel_name}
    try:
        r = await qm.client._get_client().post(
            f"{qm.svc_url}/ibmmq/rest/v2/admin/action/qmgr"
            f"/{qm.internal_name}/channel/{channel_name}/stop",
            auth=qm.client.auth,
            headers={"ibm-mq-rest-csrf-token": "blank"},
        )
        if r.status_code in (200, 201):
            log.info("rollback_stopped_channel", qm=qm_name, channel=channel_name)
            return {"status": "stopped", "channel": channel_name, "qm": qm_name}
        return {"status": "already_stopped", "channel": channel_name, "qm": qm_name}
    except Exception as exc:
        log.info("rollback_stop_channel_safe", qm=qm_name, channel=channel_name, note=str(exc))
        return {"status": "already_absent_or_stopped", "channel": channel_name, "qm": qm_name}


async def delete_channel_safe(qm_name: str, channel_name: str) -> dict:
    """Delete a channel. Safe to call if not found."""
    from bcl.mq.registry import get_registry

    registry = get_registry()
    qm = registry.get(qm_name)
    if qm is None:
        return {"status": "error", "error": f"QM {qm_name} not in registry", "channel": channel_name}
    try:
        r = await qm.client._get_client().delete(
            f"{qm.svc_url}/ibmmq/rest/v2/admin/qmgr"
            f"/{qm.internal_name}/channel/{channel_name}",
            auth=qm.client.auth,
            headers={"ibm-mq-rest-csrf-token": "blank"},
        )
        if r.status_code in (200, 204):
            log.info("rollback_deleted_channel", qm=qm_name, channel=channel_name)
            return {"status": "deleted", "channel": channel_name, "qm": qm_name}
        return {"status": "already_absent", "channel": channel_name, "qm": qm_name}
    except Exception as exc:
        log.info("rollback_delete_channel_safe", qm=qm_name, channel=channel_name, note=str(exc))
        return {"status": "already_absent", "channel": channel_name, "qm": qm_name}


async def restore_queue(
    qm_name: str, queue_name: str, queue_props: Optional[dict] = None
) -> dict:
    """
    Re-create a local queue if it is missing.
    Used when cutover deleted the source queue and rollback must restore it.
    """
    from bcl.mq.registry import get_registry
    from bcl.policy.engine import enforce_pre_operation

    registry = get_registry()
    qm = registry.get(qm_name)
    if qm is None:
        return {"status": "error", "error": f"QM {qm_name} not in registry", "queue": queue_name}

    try:
        r = await qm.client._get_client().get(
            f"{qm.svc_url}/ibmmq/rest/v2/admin/qmgr"
            f"/{qm.internal_name}/queue/{queue_name}",
            auth=qm.client.auth,
        )
        if r.status_code == 200:
            log.info("rollback_queue_already_present", qm=qm_name, queue=queue_name)
            return {"status": "already_present", "queue": queue_name, "qm": qm_name}
    except Exception:
        pass  # Treat GET failure as queue absent — proceed to recreate

    await enforce_pre_operation(
        {"type": "create_queue", "object_type": "queue", "name": queue_name},
        qm_name,
    )

    props = queue_props or {"description": "Restored by rollback agent"}
    await qm.client.create_queue(
        qm.internal_name, queue_name, {"type": "LOCAL", **props}
    )

    log.info("rollback_queue_restored", qm=qm_name, queue=queue_name)
    return {"status": "restored", "queue": queue_name, "qm": qm_name}


async def verify_rollback(app_id: str, source_qm: str) -> dict:
    """
    Confirm rollback success by putting/getting a test message through
    the restored source topology.
    """
    from bcl.agents.tools.validation_tools import (
        put_test_message,
        get_test_message,
        assert_delivery,
    )

    queue_name = f"Q.{app_id.upper()}.REQUEST.LOCAL"
    corr_id = str(uuid.uuid4()).replace("-", "")[:24]

    put_result = await put_test_message(
        source_qm, queue_name, f"ROLLBACK_VERIFY_{app_id}", corr_id
    )
    if "error" in put_result:
        return {
            "verified": False,
            "latency_ms": 0,
            "app_id": app_id,
            "source_qm": source_qm,
            "error": put_result["error"],
        }

    get_result = await get_test_message(source_qm, queue_name, corr_id, timeout_seconds=5)
    assertion = await assert_delivery(corr_id, get_result)

    log.info(
        "rollback_verify",
        app_id=app_id,
        source_qm=source_qm,
        passed=assertion["passed"],
        latency_ms=assertion["latency_ms"],
    )

    return {
        "verified": assertion["passed"],
        "latency_ms": assertion["latency_ms"],
        "app_id": app_id,
        "source_qm": source_qm,
        "reason": assertion.get("reason"),
    }
