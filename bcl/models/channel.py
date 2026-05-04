from pydantic import BaseModel
from typing import Optional


class ChannelCreate(BaseModel):
    name: str
    qm_name: str
    object_type: str = "channel"
    channel_type: str = "SVRCONN"
    ssl_cipher_spec: Optional[str] = None
    cross_region: bool = False
    cross_zone: bool = False
    description: Optional[str] = None
    extra: Optional[dict] = None


class ChannelResponse(BaseModel):
    name: str
    qm_name: str
    channel_type: Optional[str] = None
    status: Optional[str] = None
