from pydantic import BaseModel
from typing import Optional


class QueueCreate(BaseModel):
    name: str
    qm_name: str
    object_type: str = "queue"
    queue_type: Optional[str] = "LOCAL"
    description: Optional[str] = None
    max_depth: Optional[int] = None
    extra: Optional[dict] = None


class QueueResponse(BaseModel):
    name: str
    qm_name: str
    queue_type: Optional[str] = None
    status: Optional[str] = None
