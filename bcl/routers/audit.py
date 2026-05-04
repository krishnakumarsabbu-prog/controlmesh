from fastapi import APIRouter, Query
from typing import Optional

from bcl.state.redis_store import RedisStore

router = APIRouter(tags=["audit"])
_store = RedisStore()


@router.get("/audit")
async def get_audit_log(
    limit: int = Query(100, le=1000),
    operation: Optional[str] = None,
    qm: Optional[str] = None,
):
    events = await _store.get_audit_events(
        limit=limit,
        filter_operation=operation,
        filter_qm=qm,
    )
    return {"events": events, "count": len(events)}
