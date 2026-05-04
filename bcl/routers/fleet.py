import json

import structlog
from fastapi import APIRouter, HTTPException

from bcl.mq.registry import get_registry
from bcl.state.redis_store import get_redis_pool

log = structlog.get_logger()
router = APIRouter(tags=["fleet"])

_FLEET_CACHE_KEY = "cache:fleet:list"
_FLEET_CACHE_TTL = 10  # seconds


@router.get("/fleet")
async def list_fleet():
    try:
        r = await get_redis_pool()
        cached = await r.get(_FLEET_CACHE_KEY)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    registry = get_registry()
    result = {
        "queue_managers": [
            {
                "name": qm.name,
                "internal_name": qm.internal_name,
                "svc_url": qm.svc_url,
                "role": qm.role,
            }
            for qm in registry.list_qms()
        ]
    }

    try:
        r = await get_redis_pool()
        await r.setex(_FLEET_CACHE_KEY, _FLEET_CACHE_TTL, json.dumps(result))
    except Exception:
        pass

    return result


@router.get("/fleet/{qm_name}/status")
async def qm_status(qm_name: str):
    registry = get_registry()
    try:
        qm = registry.get(qm_name)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Queue manager '{qm_name}' not found")
    try:
        status = await qm.client.get_qmgr_status()
    except Exception as exc:
        log.warning("qm_status_failed", qm=qm_name, error=str(exc))
        raise HTTPException(status_code=503, detail=f"Could not reach QM '{qm_name}': {exc}")
    return {"qm": qm_name, "status": status}


@router.get("/fleet/topology")
async def get_topology():
    """Return the unified logical topology (source and target)."""
    from bcl.state.control_state import SOURCE_TOPOLOGY, generate_target_topology
    return {
        "source": SOURCE_TOPOLOGY,
        "target": generate_target_topology()
    }


@router.post("/fleet/bootstrap", status_code=201)
async def bootstrap_fleet():
    """
    Provision the initial 6-application shared source topology.
    This creates the queues and DLQs across the source QMs via the BCL.
    """
    from bcl.state.control_state import SOURCE_TOPOLOGY
    from bcl.mq.registry import get_registry
    from bcl.observability.log_store import emit as _emit

    registry = get_registry()
    log.info("fleet_bootstrap_started")
    await _emit("Fleet bootstrap sequence initiated — provisioning source topology", category="system")

    results = []
    for qm_config in SOURCE_TOPOLOGY["queue_managers"]:
        qm_name = qm_config["name"]
        try:
            qm = registry.get(qm_name)
        except KeyError:
            log.warning("qm_missing_during_bootstrap", qm=qm_name)
            continue

        for q_config in qm_config["queues"]:
            q_name = q_config["name"]
            try:
                # Direct client call to bypass policy checks for bootstrap (or use policy if preferred)
                await qm.client.create_queue(qm.internal_name, q_name, {"type": "local"})
                results.append({"qm": qm_name, "queue": q_name, "status": "created"})
                await _emit(f"Provisioned {q_name} on {qm_name}", category="system", qm=qm_name)
            except Exception as exc:
                results.append({"qm": qm_name, "queue": q_name, "status": "failed", "error": str(exc)})

    log.info("fleet_bootstrap_complete", total=len(results))
    await _emit(f"Fleet bootstrap complete: {len(results)} objects provisioned", category="system")
    return {"status": "complete", "results": results}
