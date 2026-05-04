from pydantic import BaseModel
from typing import Optional


class QueueManagerBase(BaseModel):
    name: str
    internal_name: str
    svc_url: str
    role: str


class QueueManagerStatus(QueueManagerBase):
    status: Optional[dict] = None
