"""
DatabaseManager — unified façade over SQLite (structural state) and
Redis (volatile/cache state) for the BCL gateway and ADK agent mesh.

Responsibilities:
  - MQ topology CRUD (SQLite source of truth)
  - Migration state machine transitions (SQLite + Redis checkpoint)
  - Topology snapshot caching in Redis (fast reads for agents)
  - Audit logging (SQLite)
"""

import atexit
import json
import logging
from datetime import datetime
from typing import Any, Optional

from db.sqlite_memory import get_db
from db.redis_memory import get_store

logger = logging.getLogger(__name__)

# Redis key prefixes
_KEY_TOPO = "topo:"          # topology cache  → topo:<qm_name>
_KEY_STATE = "state:"        # migration state → state:<app_id>
_TOPO_TTL = 300              # 5 min cache TTL for topology entries


class DatabaseManager:
    """
    Application-level database façade.

    Instantiate once and inject where needed, or use the module-level
    `manager` singleton at the bottom of this file.
    """

    def __init__(self) -> None:
        self._db = get_db()
        self._store = get_store()

    # ── MQ Topology ──────────────────────────────────────────────────────────

    def register_qm(
        self,
        qm_name: str,
        role: str,
        host: str,
        port: int = 1414,
    ) -> None:
        """
        Insert or replace a queue manager record.
        role must be 'source' or 'target'.
        """
        sql = """
        INSERT INTO mq_topology (qm_name, role, host, port, state)
        VALUES (?, ?, ?, ?, 'starting')
        ON CONFLICT(qm_name) DO UPDATE SET
            role  = excluded.role,
            host  = excluded.host,
            port  = excluded.port,
            state = excluded.state
        """
        with self._db.locked_write() as conn:
            conn.execute(sql, (qm_name, role, host, port))
        # Invalidate cache so next read fetches fresh data
        self._store.delete(_KEY_TOPO + qm_name)
        logger.info("Registered QM %s (%s) at %s:%s", qm_name, role, host, port)

    def update_qm_state(self, qm_name: str, state: str) -> None:
        """Update the runtime state of a queue manager (e.g. running, stopped)."""
        with self._db.locked_write() as conn:
            conn.execute(
                "UPDATE mq_topology SET state = ? WHERE qm_name = ?",
                (state, qm_name),
            )
        self._store.delete(_KEY_TOPO + qm_name)
        logger.debug("QM %s state → %s", qm_name, state)

    def get_qm(self, qm_name: str) -> Optional[dict[str, Any]]:
        """Return QM record, using Redis cache when available."""
        cached = self._store.get(_KEY_TOPO + qm_name)
        if cached:
            return cached

        rows = self._db.execute(
            "SELECT * FROM mq_topology WHERE qm_name = ?", (qm_name,)
        )
        if not rows:
            return None
        record = rows[0]
        self._store.set(_KEY_TOPO + qm_name, record, ttl=_TOPO_TTL)
        return record

    def list_qms(self, role: Optional[str] = None) -> list[dict[str, Any]]:
        """List all QMs, optionally filtered by role."""
        if role:
            return self._db.execute(
                "SELECT * FROM mq_topology WHERE role = ? ORDER BY qm_name",
                (role,),
            )
        return self._db.execute(
            "SELECT * FROM mq_topology ORDER BY qm_name"
        )

    # ── Migration State Machine ───────────────────────────────────────────────

    def init_migration(self, app_id: str) -> None:
        """Register a new migration for app_id in the 'pending' phase."""
        sql = """
        INSERT INTO migration_state (app_id, phase, started_at)
        VALUES (?, 'pending', ?)
        ON CONFLICT(app_id) DO NOTHING
        """
        with self._db.locked_write() as conn:
            conn.execute(sql, (app_id, datetime.utcnow().isoformat()))
        logger.info("Migration initialised for app %s", app_id)

    def advance_phase(
        self,
        app_id: str,
        new_phase: str,
        checkpoint: Optional[dict[str, Any]] = None,
    ) -> None:
        """
        Move app_id to new_phase and optionally store a checkpoint payload.
        Checkpoint is written to both SQLite (durable) and Redis (fast read).
        """
        checkpoint_json = json.dumps(checkpoint) if checkpoint else None
        completed_at = (
            datetime.utcnow().isoformat() if new_phase == "completed" else None
        )
        sql = """
        UPDATE migration_state
        SET phase = ?, checkpoint = ?, completed_at = ?
        WHERE app_id = ?
        """
        with self._db.locked_write() as conn:
            conn.execute(sql, (new_phase, checkpoint_json, completed_at, app_id))

        if checkpoint:
            self._store.set(_KEY_STATE + app_id, checkpoint, ttl=3600)

        self._audit(
            "migration_state", app_id, "phase_advance",
            payload={"new_phase": new_phase},
        )
        logger.info("App %s phase → %s", app_id, new_phase)

    def get_migration_state(self, app_id: str) -> Optional[dict[str, Any]]:
        rows = self._db.execute(
            "SELECT * FROM migration_state WHERE app_id = ?", (app_id,)
        )
        return rows[0] if rows else None

    def get_checkpoint(self, app_id: str) -> Optional[dict[str, Any]]:
        """Return the latest checkpoint from Redis (fast) or SQLite (fallback)."""
        cached = self._store.get(_KEY_STATE + app_id)
        if cached:
            return cached

        rows = self._db.execute(
            "SELECT checkpoint FROM migration_state WHERE app_id = ?", (app_id,)
        )
        if not rows or not rows[0].get("checkpoint"):
            return None
        return json.loads(rows[0]["checkpoint"])

    # ── Audit Log ─────────────────────────────────────────────────────────────

    def _audit(
        self,
        entity_type: str,
        entity_id: str,
        action: str,
        actor: Optional[str] = None,
        payload: Optional[dict[str, Any]] = None,
    ) -> None:
        sql = """
        INSERT INTO audit_log (entity_type, entity_id, action, actor, payload)
        VALUES (?, ?, ?, ?, ?)
        """
        with self._db.locked_write() as conn:
            conn.execute(
                sql,
                (
                    entity_type,
                    entity_id,
                    action,
                    actor,
                    json.dumps(payload) if payload else None,
                ),
            )

    def get_audit_log(
        self,
        entity_id: Optional[str] = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        if entity_id:
            return self._db.execute(
                "SELECT * FROM audit_log WHERE entity_id = ? ORDER BY logged_at DESC LIMIT ?",
                (entity_id, limit),
            )
        return self._db.execute(
            "SELECT * FROM audit_log ORDER BY logged_at DESC LIMIT ?", (limit,)
        )

    # ── Health check ──────────────────────────────────────────────────────────

    def health(self) -> dict[str, str]:
        """Return a simple health dict suitable for a /healthz endpoint."""
        results: dict[str, str] = {}

        try:
            self._db.execute("SELECT 1")
            results["sqlite"] = "ok"
        except Exception as exc:
            results["sqlite"] = f"error: {exc}"

        try:
            self._store.client.ping()
            results["redis"] = "ok"
        except Exception as exc:
            results["redis"] = f"error: {exc}"

        return results


# ── Module-level singleton ────────────────────────────────────────────────────

_manager: Optional[DatabaseManager] = None


def get_manager() -> DatabaseManager:
    """Return the module-level DatabaseManager (initialise on first call)."""
    global _manager
    if _manager is None:
        _manager = DatabaseManager()
    return _manager


# Register cleanup so both stores close cleanly on interpreter exit.
atexit.register(lambda: __import__("db").shutdown_all())
