from enum import Enum
from typing import Optional
from pydantic import BaseModel


class WorkspaceStep(str, Enum):
    APP_MAPPING = "app-mapping"
    SOURCE_VALIDATION = "source-validation"
    CONFIG_REDEPLOY = "config-redeploy"
    TARGET_VALIDATION = "target-validation"
    SUMMARY = "summary"


class WorkspaceService(BaseModel):
    id: str
    name: str
    type: str  # "producer" | "consumer"
    qm: str
    queue: str
    tps: int
    status: str  # "healthy" | "degraded" | "error"


class WorkspaceApplication(BaseModel):
    id: str
    name: str
    environment: str
    domain: str
    producers: list[WorkspaceService]
    consumers: list[WorkspaceService]
    status: str


class WorkspaceFlow(BaseModel):
    id: str
    name: str
    app_id: str
    source_qm: str
    target_qm: str
    active_path: str  # "source" | "target" | "both"
    traffic_split: int  # 0–100
    status: str


class ValidationCheck(BaseModel):
    id: str
    label: str
    status: str  # "pending" | "running" | "passed" | "failed" | "warning"
    detail: Optional[str] = None
    latency_ms: Optional[int] = None


class ValidationPhase(BaseModel):
    id: str
    label: str
    checks: list[ValidationCheck]


class RuntimeLogEntry(BaseModel):
    timestamp: float
    level: str  # "INFO" | "WARNING" | "ERROR" | "SUCCESS"
    service: str
    message: str


class WorkspaceTimelineEvent(BaseModel):
    id: str
    timestamp: float
    type: str  # "info" | "success" | "warning" | "error"
    title: str
    detail: Optional[str] = None
    step: WorkspaceStep


class MigrationPlan(BaseModel):
    app_id: str
    source_qm: str
    target_qm: str
    strategy: str  # "blue-green" | "cutover"
    traffic_split: int
    rollback_strategy: str  # "automatic" | "manual"
    estimated_downtime_sec: int
    steps: list[str]
