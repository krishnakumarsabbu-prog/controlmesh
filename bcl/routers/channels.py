import structlog
from fastapi import APIRouter, HTTPException, Query, Request

from bcl.models.channel import ChannelCreate, ChannelResponse
from bcl.mq.registry import get_registry
from bcl.policy.engine import enforce_pre_operation
from bcl.state.redis_store import RedisStore
from bcl.observability.metrics import MQ_OPERATION_COUNT

log = structlog.get_logger()
router = APIRouter(tags=["channels"])
_store = RedisStore()


@router.post("/channels", response_model=ChannelResponse, status_code=201)
async def create_channel(payload: ChannelCreate, request: Request):
    trace_id = getattr(request.state, "trace_id", "unknown")

    operation = {
        "type": "create_channel",
        "object_type": "channel",
        "name": payload.name,
        "channel_type": payload.channel_type,
        "ssl_cipher_spec": payload.ssl_cipher_spec,
        "cross_region": payload.cross_region,
        "cross_zone": payload.cross_zone,
    }
    await enforce_pre_operation(operation, payload.qm_name)

    registry = get_registry()
    try:
        qm = registry.get(payload.qm_name)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"QM '{payload.qm_name}' not found")

    props: dict = {"type": payload.channel_type}
    if payload.ssl_cipher_spec:
        props["sslCipherSpec"] = payload.ssl_cipher_spec
    if payload.description:
        props["description"] = payload.description
    if payload.extra:
        props.update(payload.extra)

    try:
        await qm.client.create_channel(qm.internal_name, payload.name, props)
        MQ_OPERATION_COUNT.labels("create_channel", payload.qm_name, "success").inc()
    except Exception as exc:
        MQ_OPERATION_COUNT.labels("create_channel", payload.qm_name, "error").inc()
        log.error("create_channel_failed", name=payload.name, qm=payload.qm_name, error=str(exc))
        raise HTTPException(status_code=502, detail=f"MQ error: {exc}")

    await _store.append_audit({
        "trace_id": trace_id,
        "operation": "create_channel",
        "qm_target": payload.qm_name,
        "object_name": payload.name,
        "outcome": "success",
    })

    log.info("channel_created", name=payload.name, qm=payload.qm_name, trace_id=trace_id)
    return ChannelResponse(name=payload.name, qm_name=payload.qm_name, channel_type=payload.channel_type)


@router.get("/channels")
async def list_channels(qm: str = Query(..., description="Queue manager logical name")):
    registry = get_registry()
    try:
        qm_entry = registry.get(qm)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"QM '{qm}' not found")
    try:
        result = await qm_entry.client.list_channels(qm_entry.internal_name)
    except Exception as exc:
        log.error("list_channels_failed", qm=qm, error=str(exc))
        raise HTTPException(status_code=502, detail=f"MQ error: {exc}")
    return {"qm": qm, "channels": result.get("channel", result)}


@router.delete("/channels/{name}", status_code=204)
async def delete_channel(
    name: str,
    qm: str = Query(..., description="Queue manager logical name"),
    request: Request = None,
):
    trace_id = getattr(request.state, "trace_id", "unknown") if request else "unknown"
    registry = get_registry()
    try:
        qm_entry = registry.get(qm)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"QM '{qm}' not found")
    try:
        await qm_entry.client.delete_channel(qm_entry.internal_name, name)
        MQ_OPERATION_COUNT.labels("delete_channel", qm, "success").inc()
    except Exception as exc:
        MQ_OPERATION_COUNT.labels("delete_channel", qm, "error").inc()
        raise HTTPException(status_code=502, detail=f"MQ error: {exc}")

    await _store.append_audit({
        "trace_id": trace_id,
        "operation": "delete_channel",
        "qm_target": qm,
        "object_name": name,
        "outcome": "success",
    })
