from pydantic import BaseModel
from typing import Optional, Any


class MigrationExecuteRequest(BaseModel):
    app_id: str
    phase: str
    source_qm: str
    target_qm: Optional[str] = None
    queues: Optional[list[str]] = None
    checkpoint: Optional[dict[str, Any]] = None


class MigrationStatusResponse(BaseModel):
    app_id: str
    phase: str
    checkpoint: Optional[dict[str, Any]] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None


class ValidationRequest(BaseModel):
    app_id: Optional[str] = None
    qm_name: Optional[str] = None
    operations: list[dict[str, Any]]
