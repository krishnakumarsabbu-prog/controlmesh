"""
Tests for migration state machine integration.
Run: pytest bcl/tests/test_migration.py -v

Uses the Phase-1 SQLite + Redis (in-memory) db layer.
Redis must be running on localhost:6379 or REDIS_HOST/REDIS_PORT must be set.
"""
import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../.."))


def test_migration_init_and_advance():
    from db.manager import get_manager
    mgr = get_manager()

    app_id = "test-app-migration-001"
    mgr.init_migration(app_id)

    state = mgr.get_migration_state(app_id)
    assert state is not None
    assert state["phase"] == "pending"

    mgr.advance_phase(app_id, "topology_snapshot", checkpoint={"source_qm": "QM.SRC.A"})
    state = mgr.get_migration_state(app_id)
    assert state["phase"] == "topology_snapshot"


def test_migration_idempotent_init():
    from db.manager import get_manager
    mgr = get_manager()

    app_id = "test-app-idempotent-002"
    mgr.init_migration(app_id)
    mgr.init_migration(app_id)  # second call must not raise

    state = mgr.get_migration_state(app_id)
    assert state["app_id"] == app_id


def test_migration_full_lifecycle():
    from db.manager import get_manager
    mgr = get_manager()

    app_id = "test-app-lifecycle-003"
    phases = [
        ("topology_snapshot", {"source_qm": "QM.SRC.A", "queues": ["Q.PAY.IN.LOCAL"]}),
        ("traffic_mirror", {"mirrored": True}),
        ("shadow_mode", None),
        ("cutover", {"traffic": "target"}),
        ("completed", None),
    ]

    mgr.init_migration(app_id)
    for phase, checkpoint in phases:
        mgr.advance_phase(app_id, phase, checkpoint=checkpoint)

    state = mgr.get_migration_state(app_id)
    assert state["phase"] == "completed"
    assert state["completed_at"] is not None


def test_audit_log_captures_migration_events():
    from db.manager import get_manager
    mgr = get_manager()

    app_id = "test-app-audit-004"
    mgr.init_migration(app_id)
    mgr.advance_phase(app_id, "topology_snapshot")

    audit = mgr.get_audit_log(entity_id=app_id, limit=10)
    assert len(audit) >= 1
    actions = [e["action"] for e in audit]
    assert "phase_advance" in actions
