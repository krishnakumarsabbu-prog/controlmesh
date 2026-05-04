import asyncio

import structlog
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

from bcl.models.migration import (
    ExecuteMigrationRequest,
    MigrationState,
    TransitionRequest,
)
from bcl.state.redis_store import RedisStore
from bcl.state.state_machine import MigrationStateMachine
from bcl.state.control_state import (
    get_state,
    append_log,
    set_execution_state,
    ExecutionState,
)
from bcl.observability.metrics import MIGRATION_PHASE_COUNT
from bcl.observability.log_store import emit as _emit

log = structlog.get_logger()
router = APIRouter(tags=["migration"])

_store = RedisStore()
_sm = MigrationStateMachine(_store)


class MigrationPlanRequest(BaseModel):
    app_id: str
    source_qm: str
    target_qm: str


@router.post("/migration/plan", status_code=200)
async def plan_migration(req: MigrationPlanRequest):
    """
    Generate a migration plan for an application.
    Stores the plan in the unified in-memory state and returns the step list.
    """
    state = get_state()

    if state.execution_state not in (ExecutionState.IDLE, ExecutionState.ROLLED_BACK):
        raise HTTPException(
            status_code=409,
            detail=f"Cannot plan while system is in state: {state.execution_state}",
        )

    set_execution_state(ExecutionState.PLANNING)
    append_log(
        f"Migration plan requested for {req.app_id}",
        app_id=req.app_id,
        source_qm=req.source_qm,
        target_qm=req.target_qm,
    )
    await _emit(
        f"Migration plan requested for {req.app_id}",
        category="migration",
        app_id=req.app_id,
        source_qm=req.source_qm,
        target_qm=req.target_qm,
    )

    safe_id = req.app_id.replace("-", "").upper()
    plan = [
        {
            "step": 1,
            "phase": "BASELINE_VALIDATION",
            "description": f"Validate source flows are operational on {req.source_qm}",
            "qm": req.source_qm,
        },
        {
            "step": 2,
            "phase": "SNAPSHOT",
            "description": f"Capture pre-migration topology snapshot of {req.source_qm}",
            "qm": req.source_qm,
        },
        {
            "step": 3,
            "phase": "PROVISION_TARGET",
            "description": (
                f"Create target QM {req.target_qm} with DLQ Q.{safe_id}.DLQ.LOCAL, "
                f"application queues, channels, and listener"
            ),
            "qm": req.target_qm,
        },
        {
            "step": 4,
            "phase": "REWIRE",
            "description": (
                f"Install xmit queue and remote queue definitions on {req.source_qm} "
                f"to transparently route traffic to {req.target_qm}"
            ),
            "qm": req.source_qm,
        },
        {
            "step": 5,
            "phase": "POST_REWIRE_VALIDATION",
            "description": "Verify transparent routing: producers unchanged, messages reach target",
            "qm": req.target_qm,
        },
        {
            "step": 6,
            "phase": "CUTOVER",
            "description": f"Remove local queue from {req.source_qm} to complete cutover",
            "qm": req.source_qm,
        },
        {
            "step": 7,
            "phase": "FINAL_VALIDATION",
            "description": "Confirm final state and message delivery on target QM",
            "qm": req.target_qm,
        },
    ]

    state.migration_plan = plan
    set_execution_state(ExecutionState.IDLE)
    append_log(
        f"Migration plan generated: {len(plan)} steps",
        app_id=req.app_id,
    )

    log.info(
        "migration_plan_generated",
        app_id=req.app_id,
        source_qm=req.source_qm,
        target_qm=req.target_qm,
        steps=len(plan),
    )

    return {
        "app_id": req.app_id,
        "source_qm": req.source_qm,
        "target_qm": req.target_qm,
        "plan": plan,
        "total_steps": len(plan),
    }


@router.post("/migration/execute", status_code=202)
async def execute_migration(req: ExecuteMigrationRequest, request: Request):
    """
    Trigger a migration for one application.
    Captures a topology snapshot then transitions through the state machine.
    """
    from bcl.policy.engine import enforce_pre_operation

    trace_id = getattr(request.state, "trace_id", "unknown")
    ctrl = get_state()

    await enforce_pre_operation(
        {"type": "migrate", "app_id": req.app_id},
        req.source_qm,
    )

    record = await _sm.get(req.app_id)
    if record.state not in (MigrationState.IDLE, MigrationState.ROLLED_BACK):
        raise HTTPException(
            status_code=400,
            detail=f"App {req.app_id} already in migration: {record.state}",
        )

    set_execution_state(ExecutionState.EXECUTING)
    append_log(
        f"Migration execute started for {req.app_id}",
        app_id=req.app_id,
        source_qm=req.source_qm,
        target_qm=req.target_qm,
        trace_id=trace_id,
    )
    await _emit(
        f"Migration started: {req.app_id} ({req.source_qm} → {req.target_qm})",
        category="migration",
        level="INFO",
        app_id=req.app_id,
        source_qm=req.source_qm,
        target_qm=req.target_qm,
        trace_id=trace_id,
    )

    snapshot = await _capture_topology_snapshot(req.source_qm)
    snapshot_key = await _store.save_snapshot(req.app_id, "pre_migration", snapshot)

    record = await _sm.transition(
        req.app_id,
        MigrationState.SNAPSHOTTED,
        {
            "snapshot_key": snapshot_key,
            "source_qm": req.source_qm,
            "target_qm": req.target_qm,
        },
    )
    record.source_qm = req.source_qm
    record.target_qm = req.target_qm
    record.snapshot_key = snapshot_key
    await _store.save_migration_record(record)

    asyncio.create_task(
        _run_agent_pipeline(req.app_id, req.source_qm, req.target_qm, snapshot_key)
    )

    MIGRATION_PHASE_COUNT.labels(req.app_id, MigrationState.SNAPSHOTTED.value).inc()

    await _store.append_audit(
        {
            "trace_id": trace_id,
            "operation": "migration_execute",
            "qm_target": req.source_qm,
            "app_id": req.app_id,
            "state": record.state.value,
            "outcome": "accepted",
        }
    )

    log.info(
        "migration_started",
        app_id=req.app_id,
        source_qm=req.source_qm,
        target_qm=req.target_qm,
        trace_id=trace_id,
    )

    return {
        "status": "started",
        "app_id": req.app_id,
        "state": record.state,
        "snapshot_key": snapshot_key,
        "trace_id": trace_id,
    }


@router.post("/migration/{app_id}/transition", status_code=200)
async def manual_transition(app_id: str, body: TransitionRequest):
    """Manually advance a migration state (for operator overrides and testing)."""
    record = await _sm.transition(app_id, body.new_state, body.metadata)
    MIGRATION_PHASE_COUNT.labels(app_id, body.new_state.value).inc()
    return {"app_id": app_id, "state": record.state, "updated_at": record.updated_at}


@router.get("/migration/status")
async def get_all_migration_status():
    records = await _store.list_migration_records()
    return {
        "migrations": [
            {
                "app_id": r.app_id,
                "state": r.state,
                "source_qm": r.source_qm,
                "target_qm": r.target_qm,
                "started_at": r.started_at,
                "updated_at": r.updated_at,
                "error": r.error,
                "validation_results": r.validation_results,
            }
            for r in records
        ]
    }


@router.get("/migration/{app_id}/status")
async def get_migration_status(app_id: str):
    record = await _sm.get(app_id)
    return {
        "app_id": record.app_id,
        "state": record.state,
        "source_qm": record.source_qm,
        "target_qm": record.target_qm,
        "started_at": record.started_at,
        "updated_at": record.updated_at,
        "error": record.error,
        "validation_results": record.validation_results,
    }


@router.get("/migration/{app_id}/history")
async def get_migration_history(app_id: str):
    record = await _sm.get(app_id)
    return {"app_id": app_id, "history": record.history}


@router.post("/migration/{app_id}/rollback", status_code=202)
async def trigger_rollback(app_id: str, request: Request):
    """
    Manually trigger rollback for an application migration.
    Transitions to ROLLING_BACK then runs the rollback agent asynchronously.
    """
    trace_id = getattr(request.state, "trace_id", "unknown")
    record = await _sm.get(app_id)

    rollback_eligible = {
        MigrationState.PROVISIONING_TARGET,
        MigrationState.REWIRING,
        MigrationState.VALIDATING,
        MigrationState.ROLLING_BACK,
    }
    if record.state not in rollback_eligible:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot roll back {app_id} from state {record.state}",
        )

    if record.state != MigrationState.ROLLING_BACK:
        await _sm.transition(
            app_id, MigrationState.ROLLING_BACK, {"triggered_by": "manual_api"}
        )
        MIGRATION_PHASE_COUNT.labels(app_id, MigrationState.ROLLING_BACK.value).inc()

    set_execution_state(ExecutionState.ROLLED_BACK)
    append_log(
        f"Rollback triggered for {app_id}",
        app_id=app_id,
        trace_id=trace_id,
    )
    await _emit(
        f"Rollback triggered for {app_id}",
        category="rollback",
        level="WARNING",
        app_id=app_id,
        source_qm=record.source_qm,
        target_qm=record.target_qm,
        trace_id=trace_id,
    )

    asyncio.create_task(_run_rollback_pipeline(app_id))

    await _store.append_audit(
        {
            "trace_id": trace_id,
            "operation": "rollback_trigger",
            "qm_target": record.source_qm,
            "app_id": app_id,
            "state": MigrationState.ROLLING_BACK.value,
            "outcome": "accepted",
        }
    )

    log.info("rollback_triggered", app_id=app_id, trace_id=trace_id)
    return {
        "status": "rolling_back",
        "app_id": app_id,
        "state": MigrationState.ROLLING_BACK,
        "trace_id": trace_id,
    }


async def _run_rollback_pipeline(app_id: str) -> None:
    """Fire-and-forget rollback pipeline."""
    from bcl.agents.rollback_agent import run_rollback

    try:
        result = await run_rollback(app_id)
        status = result.get("status")
        if status == "ROLLED_BACK":
            MIGRATION_PHASE_COUNT.labels(app_id, MigrationState.ROLLED_BACK.value).inc()
            log.info("rollback_pipeline_complete", app_id=app_id)
        else:
            log.error("rollback_pipeline_failed", app_id=app_id, result=result)
    except Exception as exc:
        log.error("rollback_pipeline_exception", app_id=app_id, error=str(exc))


@router.get("/migration/stream")
async def migration_stream():
    """SSE stream for real-time UI updates on migration state changes."""
    import os
    import aioredis as _aioredis

    redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379")

    async def event_generator():
        r = await _aioredis.from_url(
            redis_url, encoding="utf-8", decode_responses=True
        )
        pubsub = r.pubsub()
        await pubsub.subscribe("sse:migration")
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    yield f"data: {message['data']}\n\n"
        finally:
            await pubsub.unsubscribe("sse:migration")
            await r.close()

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ── Internal pipeline helpers ─────────────────────────────────────────────────

async def _log_migration_step(app_id: str, phase: str, message: str, level: str = "INFO", **extra) -> None:
    await _emit(
        message,
        category="migration",
        level=level,
        app_id=app_id,
        phase=phase,
        **extra,
    )


async def _run_agent_pipeline(
    app_id: str, source_qm: str, target_qm: str, snapshot_key: str
) -> None:
    """
    Fire-and-forget migration pipeline driven by the ADK orchestrator agent.
    The orchestrator manages state transitions for PROVISIONING_TARGET through MIGRATED
    internally; this function handles the outer SNAPSHOTTED → agent → terminal transition.
    On any failure, transitions to ROLLING_BACK then ROLLED_BACK.
    """
    from bcl.agents.orchestrator import run_migration_step

    try:
        await _sm.transition(app_id, MigrationState.PROVISIONING_TARGET)
        MIGRATION_PHASE_COUNT.labels(app_id, MigrationState.PROVISIONING_TARGET.value).inc()
        await _log_migration_step(app_id, "PROVISIONING_TARGET", f"Provisioning target QM for {app_id}")

        result = await run_migration_step(app_id, source_qm, target_qm, snapshot_key)

        status = result.get("status", "FAILED")
        if status == "MIGRATED":
            MIGRATION_PHASE_COUNT.labels(app_id, MigrationState.MIGRATED.value).inc()
            set_execution_state(ExecutionState.IDLE)
            append_log(f"Migration completed for {app_id}", app_id=app_id)
            await _log_migration_step(app_id, "MIGRATED", f"Migration completed successfully for {app_id}")
            log.info("migration_completed", app_id=app_id)
        else:
            raise RuntimeError(result.get("error") or f"Agent returned status: {status}")

    except Exception as exc:
        log.error("migration_pipeline_error", app_id=app_id, error=str(exc))
        set_execution_state(ExecutionState.FAILED)
        append_log(f"Migration failed for {app_id}: {exc}", app_id=app_id, level="ERROR")
        await _log_migration_step(app_id, "FAILED", f"Migration failed for {app_id}: {exc}", level="ERROR", error=str(exc))
        try:
            await _sm.transition(app_id, MigrationState.ROLLING_BACK, {"error": str(exc)})
            MIGRATION_PHASE_COUNT.labels(app_id, MigrationState.ROLLING_BACK.value).inc()
            await _log_migration_step(app_id, "ROLLING_BACK", f"Auto-rollback initiated for {app_id}", level="WARNING", error=str(exc))
            await _sm.transition(app_id, MigrationState.ROLLED_BACK)
            MIGRATION_PHASE_COUNT.labels(app_id, MigrationState.ROLLED_BACK.value).inc()
            await _log_migration_step(app_id, "ROLLED_BACK", f"Rollback complete for {app_id}", level="WARNING")
        except Exception as rb_exc:
            log.error("rollback_failed", app_id=app_id, error=str(rb_exc))


async def _capture_topology_snapshot(qm_name: str) -> dict:
    from bcl.mq.registry import get_registry
    import datetime as _dt

    registry = get_registry()
    entry = registry.get(qm_name)
    queues: list = []
    if entry:
        try:
            queues = await entry.client.get_qmgr_status()
        except Exception:
            pass
    return {
        "qm": qm_name,
        "queues": queues,
        "captured_at": _dt.datetime.utcnow().isoformat(),
    }
