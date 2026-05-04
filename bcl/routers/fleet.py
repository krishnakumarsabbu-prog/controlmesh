import structlog
from fastapi import APIRouter, HTTPException

from bcl.mq.registry import get_registry

log = structlog.get_logger()
router = APIRouter(tags=["fleet"])


@router.get("/fleet")
async def list_fleet():
    registry = get_registry()
    return {
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
