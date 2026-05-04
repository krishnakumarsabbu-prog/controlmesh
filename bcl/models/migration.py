from enum import Enum
from dataclasses import dataclass, field
from typing import Optional, List, Any
from pydantic import BaseModel


class MigrationState(str, Enum):
    IDLE = "IDLE"
    SNAPSHOTTED = "SNAPSHOTTED"
    PROVISIONING_TARGET = "PROVISIONING_TARGET"
    REWIRING = "REWIRING"
    VALIDATING = "VALIDATING"
    MIGRATED = "MIGRATED"
    ROLLING_BACK = "ROLLING_BACK"
    ROLLED_BACK = "ROLLED_BACK"


TRANSITIONS: dict[MigrationState, list[MigrationState]] = {
    MigrationState.IDLE:                [MigrationState.SNAPSHOTTED],
    MigrationState.SNAPSHOTTED:         [MigrationState.PROVISIONING_TARGET],
    MigrationState.PROVISIONING_TARGET: [MigrationState.REWIRING,
                                         MigrationState.ROLLING_BACK],
    MigrationState.REWIRING:            [MigrationState.VALIDATING,
                                         MigrationState.ROLLING_BACK],
    MigrationState.VALIDATING:          [MigrationState.MIGRATED,
                                         MigrationState.ROLLING_BACK],
    MigrationState.MIGRATED:            [],
    MigrationState.ROLLING_BACK:        [MigrationState.ROLLED_BACK],
    MigrationState.ROLLED_BACK:         [MigrationState.IDLE],
}

IN_PROGRESS_STATES = {
    MigrationState.PROVISIONING_TARGET,
    MigrationState.REWIRING,
    MigrationState.VALIDATING,
}


@dataclass
class MigrationRecord:
    app_id: str
    state: MigrationState = MigrationState.IDLE
    source_qm: str = ""
    target_qm: str = ""
    snapshot_key: str = ""
    active_agent: Optional[str] = None
    started_at: Optional[str] = None
    updated_at: Optional[str] = None
    error: Optional[str] = None
    history: List[dict] = field(default_factory=list)
    validation_results: List[dict] = field(default_factory=list)


# ── Pydantic request/response models ─────────────────────────────────────────

class ExecuteMigrationRequest(BaseModel):
    app_id: str
    source_qm: str
    target_qm: str


class TransitionRequest(BaseModel):
    new_state: MigrationState
    metadata: Optional[dict] = None


class ValidationRequest(BaseModel):
    app_id: Optional[str] = None
    qm_name: Optional[str] = None
    operations: list[dict[str, Any]]


class AgentValidateRequest(BaseModel):
    app_id: str
    qm_name: str
    queue_name: str
    phase: str  # BASELINE | POST_REWIRE | FINAL


class SystemValidationRequest(BaseModel):
    queue_managers: list[dict[str, Any]]  # [{name, queues: [str], channels: [str]}]
    channels: list[dict[str, Any]]        # [{name, source_qm, target_qm}]


class SystemViolation(BaseModel):
    rule: str
    severity: str  # ERROR | WARNING
    detail: str
    entity: Optional[str] = None


class SystemValidationResponse(BaseModel):
    valid: bool
    violations: list[SystemViolation]
    summary: dict[str, int]
