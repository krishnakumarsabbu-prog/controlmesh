import json
import os
import time
from typing import Any, Optional

import aioredis
import structlog

log = structlog.get_logger()

_REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
_redis: Optional[aioredis.Redis] = None


async def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = await aioredis.from_url(
            _REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            socket_timeout=5.0,
            socket_connect_timeout=5.0,
        )
    return _redis


class RedisStore:
    """Async Redis store for audit events and migration snapshots."""

    async def append_audit(self, event: dict) -> None:
        r = await _get_redis()
        event["timestamp"] = time.time()
        await r.zadd("audit:events", {json.dumps(event): event["timestamp"]})

    async def get_audit_events(
        self,
        limit: int = 100,
        filter_operation: Optional[str] = None,
        filter_qm: Optional[str] = None,
    ) -> list:
        r = await _get_redis()
        raw = await r.zrevrange("audit:events", 0, limit - 1)
        events = [json.loads(e) for e in raw]
        if filter_operation:
            events = [e for e in events if e.get("operation") == filter_operation]
        if filter_qm:
            events = [e for e in events if e.get("qm_target") == filter_qm]
        return events

    async def set_snapshot(self, key: str, value: Any, ttl: int = 300) -> None:
        r = await _get_redis()
        await r.setex(key, ttl, json.dumps(value))

    async def get_snapshot(self, key: str) -> Optional[Any]:
        r = await _get_redis()
        raw = await r.get(key)
        return json.loads(raw) if raw else None

    async def delete(self, key: str) -> None:
        r = await _get_redis()
        await r.delete(key)

    async def health_check(self) -> bool:
        try:
            r = await _get_redis()
            return await r.ping()
        except Exception as exc:
            log.warning("redis_health_check_failed", error=str(exc))
            return False
