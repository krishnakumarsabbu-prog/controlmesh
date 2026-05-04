import structlog
from fastapi import APIRouter, HTTPException

from bcl.state.control_state import (
    get_state,
    append_log,
    set_execution_state,
    ExecutionState,
    SOURCE_TOPOLOGY,
    generate_target_topology,
)

log = structlog.get_logger()
router = APIRouter(tags=["topology"])


@router.get("/topology/current")
async def get_current_topology():
    """Return the current in-memory topology for the unified fleet."""
    state = get_state()
    append_log("GET /topology/current requested")
    return {
        "execution_state": state.execution_state,
        "topology": state.topology,
    }


@router.post("/topology/provision", status_code=201)
async def provision_topology():
    """
    Load the predefined source topology into in-memory state.
    Treats all queue managers as one unified logical system.
    """
    state = get_state()

    if state.topology:
        raise HTTPException(
            status_code=409,
            detail="Topology already provisioned. Reset the system before re-provisioning.",
        )

    state.topology = SOURCE_TOPOLOGY.copy()
    set_execution_state(ExecutionState.IDLE)
    append_log(
        "Source topology provisioned",
        qm_count=SOURCE_TOPOLOGY["total_queue_managers"],
        app_count=SOURCE_TOPOLOGY["total_apps"],
    )

    log.info(
        "topology_provisioned",
        qm_count=SOURCE_TOPOLOGY["total_queue_managers"],
        app_count=SOURCE_TOPOLOGY["total_apps"],
    )

    return {
        "status": "provisioned",
        "topology": state.topology,
    }


@router.get("/topology/target")
async def get_target_topology():
    """
    Return the generated target topology — 6 dedicated queue managers,
    one per application. Does NOT modify the current (source) topology.
    """
    append_log("GET /topology/target requested")
    target = generate_target_topology()
    log.info("target_topology_generated", qm_count=target["total_queue_managers"])
    return {"topology": target}
