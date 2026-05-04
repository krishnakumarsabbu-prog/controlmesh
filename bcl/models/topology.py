from pydantic import BaseModel
from typing import List
from bcl.models.application import Application
from bcl.models.queue_manager import QueueManager
from bcl.models.channel import Channel


class Topology(BaseModel):
    applications: List[Application] = []
    queueManagers: List[QueueManager] = []
    channels: List[Channel] = []
