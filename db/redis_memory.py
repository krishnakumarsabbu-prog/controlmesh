"""
Redis in-memory state store module.

Connects to a Redis instance configured for pure in-memory operation
(no RDB snapshots, no AOF persistence). The client uses a connection pool
so concurrent coroutines/threads share connections efficiently.

Persistence is intentionally disabled via CONFIG SET commands issued at
startup — no redis.conf changes are required on the server side for dev.
For the OCP deployment described in Phase 1 the Redis pod already runs
without a mounted PVC, so restart == blank state by design.
"""

import logging
import os
import json
from typing import Any, Optional

import redis
from redis import ConnectionPool, Redis
from redis.exceptions import ConnectionError, TimeoutError, RedisError

logger = logging.getLogger(__name__)

# ── Connection defaults (override via environment variables) ──────────────────
_DEFAULT_HOST = os.getenv("REDIS_HOST", "localhost")
_DEFAULT_PORT = int(os.getenv("REDIS_PORT", "6379"))
_DEFAULT_PASSWORD = os.getenv("REDIS_PASSWORD", None)
_DEFAULT_DB = int(os.getenv("REDIS_DB", "0"))

# Pool sizing: 10 connections is plenty for a single-process BCL gateway.
_POOL_MAX_CONNECTIONS = int(os.getenv("REDIS_POOL_MAX_CONN", "10"))
_SOCKET_TIMEOUT = float(os.getenv("REDIS_SOCKET_TIMEOUT", "2.0"))
_SOCKET_CONNECT_TIMEOUT = float(os.getenv("REDIS_CONNECT_TIMEOUT", "2.0"))


class RedisMemoryStore:
    """
    Thin wrapper around redis-py that:
      - Creates a connection pool on init
      - Disables all disk persistence at startup (pure in-memory)
      - Applies a sensible default eviction policy (allkeys-lru)
      - Provides typed helpers for the topology/state use-cases

    Usage:
        store = RedisMemoryStore()
        store.connect()

        store.set("key", {"hello": "world"}, ttl=300)
        value = store.get("key")          # returns dict
        store.delete("key")

        store.close()
    """

    def __init__(
        self,
        host: str = _DEFAULT_HOST,
        port: int = _DEFAULT_PORT,
        password: Optional[str] = _DEFAULT_PASSWORD,
        db: int = _DEFAULT_DB,
    ) -> None:
        self._host = host
        self._port = port
        self._password = password
        self._db = db
        self._pool: Optional[ConnectionPool] = None
        self._client: Optional[Redis] = None

    def connect(self) -> None:
        """Create the connection pool and validate reachability."""
        self._pool = ConnectionPool(
            host=self._host,
            port=self._port,
            password=self._password,
            db=self._db,
            max_connections=_POOL_MAX_CONNECTIONS,
            socket_timeout=_SOCKET_TIMEOUT,
            socket_connect_timeout=_SOCKET_CONNECT_TIMEOUT,
            decode_responses=True,      # always get str back, not bytes
        )
        self._client = Redis(connection_pool=self._pool)
        self._ping()
        self._configure_in_memory()
        logger.info(
            "Redis connected at %s:%s (db=%s)", self._host, self._port, self._db
        )

    def _ping(self) -> None:
        try:
            self._client.ping()
        except (ConnectionError, TimeoutError) as exc:
            raise RuntimeError(
                f"Cannot reach Redis at {self._host}:{self._port}"
            ) from exc

    def _configure_in_memory(self) -> None:
        """
        Disable both RDB and AOF persistence so Redis never touches disk.
        Also set allkeys-lru eviction so the server self-manages memory
        rather than refusing writes when maxmemory is hit.

        These CONFIG SET calls are idempotent — safe to call on every startup.
        """
        commands: list[tuple[str, str]] = [
            ("save", ""),               # disable RDB snapshot schedule
            ("appendonly", "no"),       # disable AOF write-ahead log
            ("maxmemory-policy", "allkeys-lru"),
        ]
        for key, value in commands:
            try:
                self._client.config_set(key, value)
                logger.debug("Redis CONFIG SET %s %s", key, value)
            except RedisError as exc:
                # Non-fatal: managed Redis (e.g. ElastiCache) may reject CONFIG SET.
                logger.warning("Could not apply Redis config %s=%s: %s", key, value, exc)

    # ── Generic key-value helpers ─────────────────────────────────────────────

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Serialise value to JSON and store it. ttl is seconds, None = no expiry."""
        serialised = json.dumps(value)
        if ttl:
            self._client.setex(key, ttl, serialised)
        else:
            self._client.set(key, serialised)

    def get(self, key: str) -> Optional[Any]:
        """Return deserialised value or None if key does not exist."""
        raw = self._client.get(key)
        if raw is None:
            return None
        return json.loads(raw)

    def delete(self, *keys: str) -> int:
        """Delete one or more keys. Returns the number of keys removed."""
        return self._client.delete(*keys)

    def exists(self, key: str) -> bool:
        return bool(self._client.exists(key))

    def expire(self, key: str, seconds: int) -> bool:
        return bool(self._client.expire(key, seconds))

    def ttl(self, key: str) -> int:
        """Returns remaining TTL in seconds. -1 = no expiry, -2 = key missing."""
        return self._client.ttl(key)

    # ── Hash helpers (topology snapshots) ────────────────────────────────────

    def hset(self, name: str, mapping: dict[str, Any]) -> None:
        """Store a flat dict as a Redis hash. Values are JSON-encoded."""
        encoded = {k: json.dumps(v) for k, v in mapping.items()}
        self._client.hset(name, mapping=encoded)

    def hget(self, name: str, field: str) -> Optional[Any]:
        raw = self._client.hget(name, field)
        return json.loads(raw) if raw is not None else None

    def hgetall(self, name: str) -> dict[str, Any]:
        return {k: json.loads(v) for k, v in self._client.hgetall(name).items()}

    def hdel(self, name: str, *fields: str) -> int:
        return self._client.hdel(name, *fields)

    # ── Pub/Sub helper (agent mesh event bus) ────────────────────────────────

    def publish(self, channel: str, message: Any) -> int:
        """Publish a JSON-serialised message. Returns subscriber count."""
        return self._client.publish(channel, json.dumps(message))

    def subscribe(self, *channels: str) -> redis.client.PubSub:
        """Return a PubSub object subscribed to the given channels."""
        ps = self._client.pubsub(ignore_subscribe_messages=True)
        ps.subscribe(*channels)
        return ps

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def flush(self) -> None:
        """Flush the current database (dev/test use only)."""
        self._client.flushdb()
        logger.warning("Redis db %s flushed", self._db)

    def close(self) -> None:
        if self._pool:
            self._pool.disconnect()
            self._pool = None
            self._client = None
            logger.info("Redis connection pool closed")

    @property
    def client(self) -> Redis:
        """Direct access to the underlying redis-py client for advanced use."""
        if self._client is None:
            raise RuntimeError("RedisMemoryStore not connected — call connect() first")
        return self._client


# ── Module-level singleton ────────────────────────────────────────────────────

_store: Optional[RedisMemoryStore] = None


def get_store() -> RedisMemoryStore:
    """Return the module-level RedisMemoryStore (initialise on first call)."""
    global _store
    if _store is None:
        _store = RedisMemoryStore()
        _store.connect()
    return _store


def shutdown_store() -> None:
    """Close the module-level store. Call at application exit."""
    global _store
    if _store is not None:
        _store.close()
        _store = None
