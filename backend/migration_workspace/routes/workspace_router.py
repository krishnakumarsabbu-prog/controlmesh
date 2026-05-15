"""
Migration Workspace REST routes.
Prefix: /api/migration-workspace
"""

from fastapi import APIRouter
from ..mock.data import MOCK_APPLICATIONS, MOCK_FLOWS, MOCK_VALIDATION_PHASES

router = APIRouter(prefix="/api/migration-workspace", tags=["migration-workspace"])


@router.get("/applications")
async def list_applications():
    return {"applications": MOCK_APPLICATIONS}


@router.get("/applications/{app_id}")
async def get_application(app_id: str):
    app = next((a for a in MOCK_APPLICATIONS if a["id"] == app_id), None)
    if app is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Application not found")
    return app


@router.get("/flows")
async def list_flows(app_id: str | None = None):
    flows = MOCK_FLOWS
    if app_id:
        flows = [f for f in flows if f["app_id"] == app_id]
    return {"flows": flows}


@router.get("/validation-phases")
async def get_validation_phases(phase: str = "source"):
    return {"phase": phase, "phases": MOCK_VALIDATION_PHASES}


@router.post("/plan")
async def create_migration_plan(app_id: str, source_qm: str, target_qm: str):
    return {
        "app_id": app_id,
        "source_qm": source_qm,
        "target_qm": target_qm,
        "strategy": "blue-green",
        "traffic_split": 0,
        "rollback_strategy": "automatic",
        "estimated_downtime_sec": 15,
        "steps": [
            "Capture source topology snapshot",
            "Provision target QM",
            "Update CCDT / client config",
            "Create bridge channels",
            "Dry-run message probe",
            "Shift traffic 0% → 10% → 50% → 100%",
            "Final validation on target",
            "Decommission source",
        ],
    }
