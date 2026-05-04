"""
Thin helpers for writing categorised log entries to the persistent log store.
Used by routers to emit structured, queryable log lines alongside structlog.
"""
import time
from typing import Any, Optional


async def emit(
    message: str,
    *,
    category: str = "system",
    level: str = "INFO",
    app_id: Optional[str] = None,
    trace_id: Optional[str] = None,
    **extra: Any,
) -> None:
    from bcl.state.redis_store import RedisStore

    entry: dict = {
        "timestamp": time.time(),
        "level": level,
        "category": category,
        "message": message,
    }
    if app_id:
        entry["app_id"] = app_id
    if trace_id:
        entry["trace_id"] = trace_id
    entry.update(extra)

    store = RedisStore()
    await store.append_log(entry)
