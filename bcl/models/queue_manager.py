from pydantic import BaseModel
from typing import List, Optional
from bcl.models.queue import Queue


class QueueManager(BaseModel):
    id: str
    name: str
    queues: List[Queue] = []


class QueueManagerBase(BaseModel):
    name: str
    internal_name: str
    svc_url: str
    role: str


class QueueManagerStatus(QueueManagerBase):
    status: Optional[dict] = None
