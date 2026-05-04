import json
import os
import time
from dataclasses import asdict
from typing import Any, Optional

import aioredis
import structlog

log = structlog.get_logger()

_REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
_pool: Optional[aioredis.Redis] = None


async def get_redis_pool() -> aioredis.Redis:
    global _pool
    if _pool is None:
        _pool = await aioredis.from_url(
            _REDIS_URL,
            max_connections=20,
            decode_responses=True,
            socket_timeout=5.0,
            socket_connect_timeout=5.0,
        )
    return _pool


async def _get_redis() -> aioredis.Redis:
    return await get_redis_pool()


class RedisStore:
    """Async Redis store for migration state, snapshots, SSE events, and audit."""

    # ── Migration state ───────────────────────────────────────────────────────

    async def save_migration_record(self, record) -> None:
        r = await _get_redis()
        await r.set(
            f"migration:{record.app_id}",
            json.dumps(asdict(record), default=str),
        )

    async def get_migration_record(self, app_id: str):
        from bcl.models.migration import MigrationRecord, MigrationState
        r = await _get_redis()
        raw = await r.get(f"migration:{app_id}")
        if raw is None:
            return None
        data = json.loads(raw)
        data["state"] = MigrationState(data["state"])
        return MigrationRecord(**data)

    async def list_migration_records(self) -> list:
        from bcl.models.migration import MigrationRecord, MigrationState
        r = await _get_redis()
        keys = await r.keys("migration:*")
        records = []
        for key in keys:
            raw = await r.get(key)
            if raw:
                data = json.loads(raw)
                data["state"] = MigrationState(data["state"])
                records.append(MigrationRecord(**data))
        return records

    # ── Topology snapshots ────────────────────────────────────────────────────

    async def save_snapshot(self, app_id: str, step: str, topology: dict) -> str:
        r = await _get_redis()
        key = f"snapshot:{app_id}:{step}:{int(time.time())}"
        await r.set(key, json.dumps(topology))
        await r.expire(key, 86400 * 7)
        await r.set(f"snapshot:latest:{app_id}", key)
        return key

    async def load_latest_snapshot(self, app_id: str) -> Optional[dict]:
        r = await _get_redis()
        key = await r.get(f"snapshot:latest:{app_id}")
        if not key:
            return None
        raw = await r.get(key)
        return json.loads(raw) if raw else None

    # ── Generic snapshot helpers ──────────────────────────────────────────────

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

    # ── SSE event stream ──────────────────────────────────────────────────────

    async def publish_sse_event(self, event: dict) -> None:
        r = await _get_redis()
        await r.publish("sse:migration", json.dumps(event))

    # ── Audit log ─────────────────────────────────────────────────────────────

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

    # ── Structured logs ───────────────────────────────────────────────────────

    async def append_log(self, entry: dict) -> None:
        """Append a structured log entry (timestamp + message + optional fields)."""
        r = await _get_redis()
        ts = entry.get("timestamp") or time.time()
        entry["timestamp"] = ts
        await r.zadd("bcl:logs", {json.dumps(entry, default=str): ts})
        # Keep at most 2000 entries
        await r.zremrangebyrank("bcl:logs", 0, -2001)

    async def get_logs(
        self,
        limit: int = 200,
        category: Optional[str] = None,
        level: Optional[str] = None,
        app_id: Optional[str] = None,
    ) -> list:
        r = await _get_redis()
        raw = await r.zrevrange("bcl:logs", 0, limit * 3 - 1)
        entries = [json.loads(e) for e in raw]
        if category:
            entries = [e for e in entries if e.get("category") == category]
        if level:
            entries = [e for e in entries if e.get("level") == level]
        if app_id:
            entries = [e for e in entries if e.get("app_id") == app_id]
        return entries[:limit]

    # ── Health ────────────────────────────────────────────────────────────────

    async def health_check(self) -> bool:
        try:
            r = await _get_redis()
            return await r.ping()
        except Exception as exc:
            log.warning("redis_health_check_failed", error=str(exc))
            return False
