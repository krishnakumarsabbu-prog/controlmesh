import structlog
from fastapi import APIRouter, HTTPException, Query, Request

from bcl.models.queue import QueueCreate, QueueResponse
from bcl.mq.registry import get_registry
from bcl.policy.engine import enforce_pre_operation
from bcl.state.redis_store import RedisStore
from bcl.observability.metrics import MQ_OPERATION_COUNT

log = structlog.get_logger()
router = APIRouter(tags=["queues"])
_store = RedisStore()


@router.post("/queues", response_model=QueueResponse, status_code=201)
async def create_queue(payload: QueueCreate, request: Request):
    trace_id = getattr(request.state, "trace_id", "unknown")

    operation = {
        "type": "create_queue",
        "object_type": "queue",
        "name": payload.name,
        "queue_type": payload.queue_type,
    }
    await enforce_pre_operation(operation, payload.qm_name)

    registry = get_registry()
    try:
        qm = registry.get(payload.qm_name)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"QM '{payload.qm_name}' not found")

    props: dict = {}
    if payload.queue_type:
        props["type"] = payload.queue_type.lower()
    if payload.description:
        props["description"] = payload.description
    if payload.max_depth is not None:
        props["maxDepth"] = payload.max_depth
    if payload.extra:
        props.update(payload.extra)

    try:
        await qm.client.create_queue(qm.internal_name, payload.name, props)
        MQ_OPERATION_COUNT.labels("create_queue", payload.qm_name, "success").inc()
    except Exception as exc:
        MQ_OPERATION_COUNT.labels("create_queue", payload.qm_name, "error").inc()
        log.error("create_queue_failed", name=payload.name, qm=payload.qm_name, error=str(exc))
        raise HTTPException(status_code=502, detail=f"MQ error: {exc}")

    await _store.append_audit({
        "trace_id": trace_id,
        "operation": "create_queue",
        "qm_target": payload.qm_name,
        "object_name": payload.name,
        "outcome": "success",
    })

    log.info("queue_created", name=payload.name, qm=payload.qm_name, trace_id=trace_id)
    return QueueResponse(name=payload.name, qm_name=payload.qm_name, queue_type=payload.queue_type)


@router.get("/queues")
async def list_queues(qm: str = Query(..., description="Queue manager logical name")):
    registry = get_registry()
    try:
        qm_entry = registry.get(qm)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"QM '{qm}' not found")
    try:
        result = await qm_entry.client.list_queues(qm_entry.internal_name)
    except Exception as exc:
        log.error("list_queues_failed", qm=qm, error=str(exc))
        raise HTTPException(status_code=502, detail=f"MQ error: {exc}")
    return {"qm": qm, "queues": result.get("queue", result)}


@router.delete("/queues/{name}", status_code=204)
async def delete_queue(
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
        await qm_entry.client.delete_queue(qm_entry.internal_name, name)
        MQ_OPERATION_COUNT.labels("delete_queue", qm, "success").inc()
    except Exception as exc:
        MQ_OPERATION_COUNT.labels("delete_queue", qm, "error").inc()
        raise HTTPException(status_code=502, detail=f"MQ error: {exc}")

    await _store.append_audit({
        "trace_id": trace_id,
        "operation": "delete_queue",
        "qm_target": qm,
        "object_name": name,
        "outcome": "success",
    })
