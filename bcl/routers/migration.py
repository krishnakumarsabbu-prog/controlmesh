import structlog
from fastapi import APIRouter, HTTPException, Request

from bcl.models.migration import MigrationExecuteRequest, MigrationStatusResponse
from bcl.state.redis_store import RedisStore
from bcl.observability.metrics import MIGRATION_PHASE_COUNT

# Re-use the Phase-1 DatabaseManager for durable state
# The project root (containing the db/ package) must be on PYTHONPATH.
# When running via `uvicorn bcl.main:app` from the project root this is automatic.
from db.manager import get_manager

log = structlog.get_logger()
router = APIRouter(tags=["migration"])
_store = RedisStore()

VALID_PHASES = [
    "pending",
    "topology_snapshot",
    "traffic_mirror",
    "shadow_mode",
    "cutover",
    "validation",
    "completed",
    "rollback",
]


@router.post("/migration/execute", status_code=202)
async def execute_migration(payload: MigrationExecuteRequest, request: Request):
    trace_id = getattr(request.state, "trace_id", "unknown")

    if payload.phase not in VALID_PHASES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid phase '{payload.phase}'. Valid phases: {VALID_PHASES}",
        )

    mgr = get_manager()

    # Initialise if this is the first call for this app
    existing = mgr.get_migration_state(payload.app_id)
    if not existing:
        mgr.init_migration(payload.app_id)

    checkpoint = payload.checkpoint or {}
    checkpoint.update({
        "source_qm": payload.source_qm,
        "queues": payload.queues or [],
    })
    if payload.target_qm:
        checkpoint["target_qm"] = payload.target_qm

    mgr.advance_phase(payload.app_id, payload.phase, checkpoint=checkpoint)
    MIGRATION_PHASE_COUNT.labels(payload.app_id, payload.phase).inc()

    await _store.append_audit({
        "trace_id": trace_id,
        "operation": "migration_execute",
        "qm_target": payload.source_qm,
        "app_id": payload.app_id,
        "phase": payload.phase,
        "outcome": "accepted",
    })

    log.info(
        "migration_phase_advanced",
        app_id=payload.app_id,
        phase=payload.phase,
        trace_id=trace_id,
    )
    return {
        "app_id": payload.app_id,
        "phase": payload.phase,
        "status": "accepted",
        "trace_id": trace_id,
    }


@router.get("/migration/status")
async def migration_status(app_id: str = None):
    mgr = get_manager()
    if app_id:
        state = mgr.get_migration_state(app_id)
        if not state:
            raise HTTPException(status_code=404, detail=f"No migration found for app '{app_id}'")
        checkpoint = mgr.get_checkpoint(app_id)
        return MigrationStatusResponse(
            app_id=state["app_id"],
            phase=state["phase"],
            checkpoint=checkpoint,
            started_at=state.get("started_at"),
            completed_at=state.get("completed_at"),
        )

    # Return all migrations
    rows = mgr._db.execute("SELECT * FROM migration_state ORDER BY started_at DESC")
    result = []
    for row in rows:
        checkpoint = mgr.get_checkpoint(row["app_id"])
        result.append({
            "app_id": row["app_id"],
            "phase": row["phase"],
            "checkpoint": checkpoint,
            "started_at": row.get("started_at"),
            "completed_at": row.get("completed_at"),
        })
    return {"migrations": result, "count": len(result)}
