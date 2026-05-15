"""
Migration Workspace REST + SSE routes.
Prefix: /api/migration-workspace
"""

import asyncio
import json
import time
import random
import uuid
from typing import Optional, AsyncGenerator

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..services.workspace_service import WorkspaceService
from ..services.deployment_service import DeploymentService
from ..services.validation_service import ValidationService

router = APIRouter(prefix="/api/migration-workspace", tags=["migration-workspace"])

_workspace_svc = WorkspaceService()
_deploy_svc = DeploymentService()
_validation_svc = ValidationService()


# ── Request bodies ─────────────────────────────────────────────────────────────

class ValidateSourceRequest(BaseModel):
    source_qm: str
    target_qm: str
    app_id: Optional[str] = None
    session_id: Optional[str] = None

class RedeployRequest(BaseModel):
    strategy: str = "blue-green"
    queue_manager: str
    channel: str
    host: str
    port: str = "1414"
    queue_name: str
    tls: bool = True
    retry_policy: str = "exponential"
    app_id: Optional[str] = None
    session_id: Optional[str] = None

class ValidateTargetRequest(BaseModel):
    target_qm: str
    app_id: Optional[str] = None
    session_id: Optional[str] = None

class TrafficShiftRequest(BaseModel):
    flow_id: str
    traffic_split: int  # 0-100
    session_id: Optional[str] = None

class RollbackRequest(BaseModel):
    flow_id: str
    reason: Optional[str] = "User requested rollback"
    session_id: Optional[str] = None

class CreateSessionRequest(BaseModel):
    app_id: str
    flow_id: str


# ── Application endpoints ──────────────────────────────────────────────────────

@router.get("/applications")
async def list_applications():
    return {"applications": _workspace_svc.list_applications()}


@router.get("/applications/{app_id}")
async def get_application(app_id: str):
    app = _workspace_svc.get_application(app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app


@router.get("/applications/{app_id}/metrics")
async def get_application_metrics(app_id: str):
    app = _workspace_svc.get_application(app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return _workspace_svc.get_live_metrics(app_id)


# ── Flow endpoints ─────────────────────────────────────────────────────────────

@router.get("/flows")
async def list_flows(app_id: Optional[str] = Query(default=None)):
    return {"flows": _workspace_svc.list_flows(app_id)}


@router.get("/flows/{flow_id}")
async def get_flow(flow_id: str):
    flow = _workspace_svc.get_flow(flow_id)
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")
    return flow


# ── Session endpoints ──────────────────────────────────────────────────────────

@router.post("/sessions")
async def create_session(body: CreateSessionRequest):
    session = _workspace_svc.create_session(body.app_id, body.flow_id)
    return session


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    session = _workspace_svc.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


# ── Validation endpoints ───────────────────────────────────────────────────────

@router.post("/validate-source")
async def validate_source(body: ValidateSourceRequest):
    result = _validation_svc.run_source_validation(body.source_qm, body.target_qm)
    if body.session_id:
        _workspace_svc.add_timeline_event(
            body.session_id, "success",
            "Source Validation Passed",
            f"{body.source_qm} connectivity and topology verified",
            "source-validation",
        )
    return result


@router.post("/validate-target")
async def validate_target(body: ValidateTargetRequest):
    result = _validation_svc.run_target_validation(body.target_qm)
    if body.session_id:
        _workspace_svc.add_timeline_event(
            body.session_id, "success",
            "Target Validation Passed",
            f"{body.target_qm} fully validated — ready for traffic shift",
            "target-validation",
        )
    return result


@router.get("/validate-source/stream")
async def stream_source_validation(
    source_qm: str = Query(...),
    target_qm: str = Query(...),
):
    async def event_generator():
        async for event in _validation_svc.stream_source_validation(source_qm, target_qm):
            yield f"data: {json.dumps(event)}\n\n"
        yield "data: {\"type\": \"done\"}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/validate-target/stream")
async def stream_target_validation(
    target_qm: str = Query(...),
):
    async def event_generator():
        async for event in _validation_svc.stream_target_validation(target_qm):
            yield f"data: {json.dumps(event)}\n\n"
        yield "data: {\"type\": \"done\"}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ── Deployment endpoint ────────────────────────────────────────────────────────

@router.post("/redeploy")
async def redeploy(body: RedeployRequest):
    config = {
        "queue_manager": body.queue_manager,
        "channel": body.channel,
        "host": body.host,
        "port": body.port,
        "queue_name": body.queue_name,
        "tls": body.tls,
        "retry_policy": body.retry_policy,
    }
    result = await _deploy_svc.run_deployment(body.strategy, config)
    if body.session_id:
        _workspace_svc.add_timeline_event(
            body.session_id, "success",
            "Config & Redeploy Complete",
            f"Runtime config updated and {body.strategy} deployment successful",
            "config-redeploy",
        )
    return result


@router.get("/redeploy/stream")
async def stream_redeploy(
    strategy: str = Query(default="blue-green"),
    queue_manager: str = Query(default="CLOUD.PAY.QM1"),
    channel: str = Query(default="CLOUD.SVRCONN"),
    host: str = Query(default="cloud.pay.qm1.mq.ibm.com"),
    port: str = Query(default="1414"),
    queue_name: str = Query(default="PAY.EVENT.OUT"),
    tls: bool = Query(default=True),
    retry_policy: str = Query(default="exponential"),
):
    config = {
        "queue_manager": queue_manager,
        "channel": channel,
        "host": host,
        "port": port,
        "queue_name": queue_name,
        "tls": tls,
        "retry_policy": retry_policy,
    }

    async def event_generator():
        async for line in _deploy_svc.stream_deployment(strategy, config):
            yield f"data: {json.dumps(line)}\n\n"
        yield "data: {\"type\": \"done\"}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ── Traffic shift endpoint ─────────────────────────────────────────────────────

@router.post("/traffic-shift")
async def traffic_shift(body: TrafficShiftRequest):
    if not (0 <= body.traffic_split <= 100):
        raise HTTPException(status_code=422, detail="traffic_split must be between 0 and 100")

    active_path = "source" if body.traffic_split == 0 else "target" if body.traffic_split == 100 else "both"
    status = "migrating" if 0 < body.traffic_split < 100 else "migrated" if body.traffic_split == 100 else "idle"

    updated = _workspace_svc.update_flow(body.flow_id, {
        "traffic_split": body.traffic_split,
        "active_path": active_path,
        "status": status,
    })
    if not updated:
        raise HTTPException(status_code=404, detail="Flow not found")

    if body.session_id:
        _workspace_svc.add_timeline_event(
            body.session_id, "info",
            f"Traffic Shifted {body.traffic_split}%",
            f"SOURCE {100 - body.traffic_split}% → TARGET {body.traffic_split}%",
            "target-validation",
        )

    return {
        "flow_id": body.flow_id,
        "traffic_split": body.traffic_split,
        "active_path": active_path,
        "status": status,
        "source_pct": 100 - body.traffic_split,
        "target_pct": body.traffic_split,
        "updated_at": time.time(),
    }


# ── Rollback endpoint ──────────────────────────────────────────────────────────

@router.post("/rollback")
async def rollback(body: RollbackRequest):
    updated = _workspace_svc.update_flow(body.flow_id, {
        "traffic_split": 0,
        "active_path": "source",
        "status": "idle",
    })
    if not updated:
        raise HTTPException(status_code=404, detail="Flow not found")

    if body.session_id:
        _workspace_svc.add_timeline_event(
            body.session_id, "warning",
            "Rollback Executed",
            body.reason or "Traffic returned to source QM",
            "target-validation",
        )

    return {
        "flow_id": body.flow_id,
        "status": "rolled_back",
        "reason": body.reason,
        "traffic_split": 0,
        "active_path": "source",
        "rolled_back_at": time.time(),
    }


# ── Log stream endpoint ────────────────────────────────────────────────────────

@router.get("/logs/stream")
async def stream_logs(
    app_id: Optional[str] = Query(default=None),
    session_id: Optional[str] = Query(default=None),
):
    """SSE endpoint that streams live MQ event logs."""

    LOG_TEMPLATES = [
        ("INFO",    "{app}",         "Health check: OK — {qm} active"),
        ("INFO",    "{qm}",          "Message batch enqueued ({count} msgs)"),
        ("SUCCESS", "LedgerService", "Consumed {count} messages from PAY.EVENT.IN"),
        ("INFO",    "{app}",         "Message dispatched: MSG-{msgid}"),
        ("INFO",    "{qm}",          "Queue depth: {depth} messages"),
        ("INFO",    "CHANNEL.PAY",   "Transfer latency: {lat}ms"),
        ("WARNING", "PAY.DLQ",       "DLQ depth: {dlq} messages — monitor threshold"),
        ("SUCCESS", "LedgerService", "ACK sent — {count} messages committed"),
        ("INFO",    "{app}",         "Producer throughput: {tps} TPS"),
    ]

    app = _workspace_svc.get_application(app_id) if app_id else None
    app_name = app["name"] if app else "PaymentAPI"
    qm_name = app["producers"][0]["qm"] if app and app.get("producers") else "PAY.QM1"

    async def event_generator():
        while True:
            template = random.choice(LOG_TEMPLATES)
            level, service_tmpl, msg_tmpl = template

            service = (
                service_tmpl
                .replace("{app}", app_name)
                .replace("{qm}", qm_name)
            )
            message = (
                msg_tmpl
                .replace("{app}", app_name)
                .replace("{qm}", qm_name)
                .replace("{count}", str(random.randint(10, 200)))
                .replace("{msgid}", uuid.uuid4().hex[:8].upper())
                .replace("{depth}", str(random.randint(0, 80)))
                .replace("{lat}", str(random.randint(5, 95)))
                .replace("{dlq}", str(random.randint(0, 50)))
                .replace("{tps}", str(random.randint(800, 6000)))
            )

            event = {
                "id": uuid.uuid4().hex[:8],
                "timestamp": time.time(),
                "level": level,
                "service": service,
                "message": message,
            }
            yield f"data: {json.dumps(event)}\n\n"
            await asyncio.sleep(random.uniform(1.5, 4.0))

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ── Migration plan endpoint ────────────────────────────────────────────────────

@router.post("/plan")
async def create_migration_plan(
    app_id: str = Query(...),
    source_qm: str = Query(...),
    target_qm: str = Query(...),
    strategy: str = Query(default="blue-green"),
):
    app = _workspace_svc.get_application(app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    steps = [
        "Capture source topology snapshot",
        f"Provision target QM: {target_qm}",
        "Update CCDT / client config",
        "Create bridge channels",
        "Dry-run message probe",
        "Shift traffic 0% → 10% → 50% → 100%",
        f"Final validation on {target_qm}",
        f"Decommission {source_qm}",
    ]

    if strategy == "canary":
        steps = [
            "Capture source topology snapshot",
            f"Provision canary environment: {target_qm}",
            "Deploy canary with 10% traffic weight",
            "Monitor canary metrics (error rate, latency)",
            "Promote canary: 50% → 100%",
            f"Decommission {source_qm}",
        ]
    elif strategy == "rolling":
        steps = [
            "Capture source topology snapshot",
            f"Update pod runtime config → {target_qm}",
            "Rolling restart: replace pods one by one",
            "Verify each pod with readiness probe",
            "Complete rollout — all pods on new config",
        ]

    return {
        "app_id": app_id,
        "app_name": app["name"],
        "source_qm": source_qm,
        "target_qm": target_qm,
        "strategy": strategy,
        "traffic_split": 0,
        "rollback_strategy": "automatic",
        "estimated_downtime_sec": 0 if strategy == "blue-green" else 15 if strategy == "immediate" else 5,
        "steps": steps,
        "created_at": time.time(),
    }


# ── Validation phases (static check definitions) ──────────────────────────────

@router.get("/validation-phases")
async def get_validation_phases(phase: str = Query(default="source")):
    if phase == "target":
        checks = [
            {"id": c["id"], "label": c["label"], "status": "pending", "detail": None, "latency_ms": None}
            for c in ValidationService.__dict__.get("TARGET_VALIDATION_CHECKS", [])
        ]
        # Use the module-level list
        from ..services.validation_service import TARGET_VALIDATION_CHECKS
        checks = [
            {"id": c["id"], "label": c["label"], "status": "pending", "detail": None, "latency_ms": None}
            for c in TARGET_VALIDATION_CHECKS
        ]
        phases = [
            {"id": "phase-connectivity", "label": "Connectivity",       "checks": checks[:3]},
            {"id": "phase-topology",     "label": "Topology Snapshot",  "checks": checks[3:6]},
            {"id": "phase-flow",         "label": "Live Flow Probe",     "checks": checks[6:]},
        ]
    else:
        from ..services.validation_service import SOURCE_VALIDATION_CHECKS
        checks = [
            {"id": c["id"], "label": c["label"], "status": "pending", "detail": None, "latency_ms": None}
            for c in SOURCE_VALIDATION_CHECKS
        ]
        phases = [
            {"id": "phase-connectivity", "label": "Connectivity",       "checks": checks[:3]},
            {"id": "phase-topology",     "label": "Topology Snapshot",  "checks": checks[3:6]},
            {"id": "phase-flow",         "label": "Live Flow Probe",     "checks": checks[6:]},
        ]

    return {"phase": phase, "phases": phases}


# ── Migration summary endpoint ─────────────────────────────────────────────────

@router.get("/summary/{session_id}")
async def get_migration_summary(session_id: str):
    session = _workspace_svc.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    flow = _workspace_svc.get_flow(session["flow_id"])
    app = _workspace_svc.get_application(session["app_id"])

    return {
        "session_id": session_id,
        "app_name": app["name"] if app else "Unknown",
        "flow_name": flow["name"] if flow else "Unknown",
        "source_qm": flow["source_qm"] if flow else "—",
        "target_qm": flow["target_qm"] if flow else "—",
        "traffic_split": flow["traffic_split"] if flow else 0,
        "status": flow["status"] if flow else "unknown",
        "timeline": session["timeline"],
        "log_count": len(session["logs"]),
        "metrics": {
            "success_rate": 99.92,
            "messages_migrated": 124550,
            "avg_latency_ms": 42,
            "estimated_downtime_sec": 12,
        },
        "completed_at": time.time(),
    }
