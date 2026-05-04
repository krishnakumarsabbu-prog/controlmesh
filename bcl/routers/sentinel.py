from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import asyncio
import logging
from typing import List, Dict
from bcl.observability.log_store import emit as _emit

log = logging.getLogger("sentinel")
router = APIRouter(tags=["sentinel"])

class DriftIssue(BaseModel):
    id: string
    qm: string
    object_type: string
    object_name: string
    expected_value: string
    actual_value: string
    severity: string

class SentinelState:
    monitoring: bool = True
    issues: List[Dict] = []

_state = SentinelState()

@router.get("/sentinel/status")
async def get_sentinel_status():
    return {
        "monitoring": _state.monitoring,
        "issue_count": len(_state.issues),
        "issues": _state.issues
    }

@router.post("/sentinel/scan")
async def perform_scan():
    """
    Simulate a scan of the fleet to detect 'Drift' 
    (Manual changes made outside the BCL).
    """
    await _emit("Sentinel scanning fleet for configuration drift...", category="sentinel")
    await asyncio.sleep(1.5)
    
    # Mock some drift detections
    _state.issues = [
        {
            "id": "drift-001",
            "qm": "QM.APP1",
            "object_type": "QUEUE",
            "object_name": "Q.APP1.REQUEST.LOCAL",
            "issue": "MAXDEPTH modified from 5000 to 100000",
            "severity": "MEDIUM"
        },
        {
            "id": "drift-002",
            "qm": "QM.SRC.A",
            "object_type": "CHANNEL",
            "object_name": "CHL.SRCA.SRCB",
            "issue": "SSLCIPH changed manually to NULL_SHA",
            "severity": "CRITICAL"
        }
    ]
    
    await _emit(f"Scan complete. {len(_state.issues)} drift issues detected.", category="sentinel", level="WARNING")
    return {"status": "scan_complete", "issues": _state.issues}

@router.post("/sentinel/heal/{issue_id}")
async def heal_issue(issue_id: str):
    """
    Autonomous self-healing: Revert the object back to the BCL's known good state.
    """
    issue = next((i for i in _state.issues if i["id"] == issue_id), None)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
        
    await _emit(f"Initiating self-healing for {issue['object_name']} on {issue['qm']}...", category="agent")
    await asyncio.sleep(1.2)
    
    # Re-apply BCL configuration
    await _emit(f"Successfully reverted {issue['object_name']} to enterprise standard configuration.", category="agent", level="SUCCESS")
    
    _state.issues = [i for i in _state.issues if i["id"] != issue_id]
    return {"status": "healed", "issue_id": issue_id}

@router.post("/sentinel/heal-all")
async def heal_all():
    count = len(_state.issues)
    for issue in list(_state.issues):
        await heal_issue(issue["id"])
    return {"status": "all_healed", "count": count}
