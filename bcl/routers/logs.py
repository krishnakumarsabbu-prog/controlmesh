import time
from typing import Optional

import structlog
from fastapi import APIRouter, Query

from bcl.state.redis_store import RedisStore

log = structlog.get_logger()
router = APIRouter(tags=["logs"])

_store = RedisStore()


@router.get("/logs")
async def get_logs(
    limit: int = Query(default=200, le=1000),
    category: Optional[str] = Query(default=None),
    level: Optional[str] = Query(default=None),
    app_id: Optional[str] = Query(default=None),
):
    entries = await _store.get_logs(
        limit=limit, category=category, level=level, app_id=app_id
    )
    return {"logs": entries, "count": len(entries)}


@router.post("/logs", status_code=201)
async def write_log(body: dict):
    """Internal endpoint: write a structured log entry."""
    body.setdefault("timestamp", time.time())
    body.setdefault("level", "INFO")
    await _store.append_log(body)
    return {"status": "ok"}
