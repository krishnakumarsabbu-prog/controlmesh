"""
db package — in-memory database layer for Phase 1.

Import surface:
    from db import get_db, get_store, shutdown_all
"""

from db.sqlite_memory import get_db, shutdown_db, SQLiteMemoryDB
from db.redis_memory import get_store, shutdown_store, RedisMemoryStore


def init_all() -> tuple[SQLiteMemoryDB, RedisMemoryStore]:
    """
    Initialise both stores in the correct order.
    Safe to call multiple times — returns existing instances after first call.
    """
    db = get_db()
    store = get_store()
    return db, store


def shutdown_all() -> None:
    """Cleanly shut down both stores. Register with atexit or call in app teardown."""
    shutdown_store()
    shutdown_db()


__all__ = [
    "get_db",
    "get_store",
    "init_all",
    "shutdown_all",
    "SQLiteMemoryDB",
    "RedisMemoryStore",
]
