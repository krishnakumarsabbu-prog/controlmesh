"""
SQLite in-memory database module.

Uses the :memory: connection string so all data lives in RAM.
A shared cache URI (file::memory:?cache=shared&uri=true) is used so that
multiple connections within the same process see the same in-memory database.
Thread safety is handled by check_same_thread=False combined with an explicit
threading.Lock around write operations.
"""

import sqlite3
import logging
import threading
from contextlib import contextmanager
from typing import Any, Generator, Optional

logger = logging.getLogger(__name__)

# Shared-cache URI lets every connection in this process share the same
# in-memory database rather than each getting an isolated empty one.
_MEMORY_URI = "file::memory:?cache=shared&uri=true"


class SQLiteMemoryDB:
    """
    Manages a single shared in-memory SQLite database for the process.

    Usage:
        db = SQLiteMemoryDB()
        db.init_schema()

        with db.connection() as conn:
            conn.execute("INSERT INTO events VALUES (?, ?)", (1, "test"))

        db.close()
    """

    def __init__(self, uri: str = _MEMORY_URI) -> None:
        self._uri = uri
        self._lock = threading.Lock()
        # Keep one long-lived connection open so the shared-cache database
        # is never garbage-collected while the process runs.
        self._keeper: Optional[sqlite3.Connection] = None

    def connect(self) -> None:
        """Open the keeper connection that keeps the database alive."""
        self._keeper = sqlite3.connect(
            self._uri,
            uri=True,
            check_same_thread=False,
            detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES,
        )
        self._keeper.row_factory = sqlite3.Row
        # WAL journal gives better read concurrency in multi-threaded use.
        self._keeper.execute("PRAGMA journal_mode=WAL")
        self._keeper.execute("PRAGMA foreign_keys=ON")
        logger.info("SQLite in-memory database opened (uri=%s)", self._uri)

    def init_schema(self) -> None:
        """
        Create the baseline schema.
        Add or extend tables here as the application grows.
        """
        ddl = """
        CREATE TABLE IF NOT EXISTS mq_topology (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            qm_name     TEXT    NOT NULL UNIQUE,
            role        TEXT    NOT NULL CHECK(role IN ('source', 'target')),
            host        TEXT    NOT NULL,
            port        INTEGER NOT NULL DEFAULT 1414,
            state       TEXT    NOT NULL DEFAULT 'unknown',
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS migration_state (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            app_id      TEXT    NOT NULL UNIQUE,
            phase       TEXT    NOT NULL DEFAULT 'pending',
            checkpoint  TEXT,
            started_at  TIMESTAMP,
            completed_at TIMESTAMP,
            updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS audit_log (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_type TEXT    NOT NULL,
            entity_id   TEXT    NOT NULL,
            action      TEXT    NOT NULL,
            actor       TEXT,
            payload     TEXT,
            logged_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Keep updated_at current on mq_topology rows
        CREATE TRIGGER IF NOT EXISTS trg_mq_topology_updated
        AFTER UPDATE ON mq_topology
        BEGIN
            UPDATE mq_topology SET updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.id;
        END;

        -- Keep updated_at current on migration_state rows
        CREATE TRIGGER IF NOT EXISTS trg_migration_state_updated
        AFTER UPDATE ON migration_state
        BEGIN
            UPDATE migration_state SET updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.id;
        END;
        """
        with self._lock:
            conn = self._get_raw_connection()
            try:
                conn.executescript(ddl)
                conn.commit()
                logger.info("SQLite schema initialised")
            finally:
                conn.close()

    def _get_raw_connection(self) -> sqlite3.Connection:
        """Return a new connection to the shared-cache in-memory database."""
        conn = sqlite3.connect(
            self._uri,
            uri=True,
            check_same_thread=False,
            detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES,
        )
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON")
        return conn

    @contextmanager
    def connection(self) -> Generator[sqlite3.Connection, None, None]:
        """
        Context manager yielding a database connection.
        Commits on clean exit; rolls back on any exception.
        """
        conn = self._get_raw_connection()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            logger.exception("SQLite transaction rolled back")
            raise
        finally:
            conn.close()

    @contextmanager
    def locked_write(self) -> Generator[sqlite3.Connection, None, None]:
        """
        Like connection() but also acquires the module-level write lock.
        Use for critical write paths that must not interleave.
        """
        with self._lock:
            with self.connection() as conn:
                yield conn

    def execute(self, sql: str, params: tuple = ()) -> list[dict[str, Any]]:
        """Run a single statement and return all rows as plain dicts."""
        with self.connection() as conn:
            cursor = conn.execute(sql, params)
            if cursor.description:
                columns = [d[0] for d in cursor.description]
                return [dict(zip(columns, row)) for row in cursor.fetchall()]
            return []

    def close(self) -> None:
        """Close the keeper connection, releasing the in-memory database."""
        if self._keeper:
            self._keeper.close()
            self._keeper = None
            logger.info("SQLite in-memory database closed")


# Module-level singleton — import and use directly in application code.
_db: Optional[SQLiteMemoryDB] = None


def get_db() -> SQLiteMemoryDB:
    """Return the module-level SQLiteMemoryDB instance (initialise on first call)."""
    global _db
    if _db is None:
        _db = SQLiteMemoryDB()
        _db.connect()
        _db.init_schema()
    return _db


def shutdown_db() -> None:
    """Cleanly close the module-level instance. Call at application exit."""
    global _db
    if _db is not None:
        _db.close()
        _db = None
