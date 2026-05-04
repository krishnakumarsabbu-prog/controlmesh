"""
Evidence test: proves full APP1 migration through BCL.
Requires live MQ pods (qm-src-a, qm-app1) and BCL running.

Run: pytest tests/integration/test_full_migration_app1.py -v --tb=short
"""
import os
import time
import pytest
import httpx

BCL_URL = os.environ.get("BCL_URL", "http://bcl-gateway-svc:8000")


@pytest.fixture(scope="module")
def client():
    c = httpx.Client(base_url=BCL_URL, timeout=120)
    yield c
    c.close()


def test_01_source_topology_exists(client):
    """Source queues provisioned on QM.SRC.A."""
    r = client.get("/api/queues", params={"qm": "QM.SRC.A"})
    assert r.status_code == 200
    names = [q["name"] for q in r.json().get("queues", [])]
    assert "Q.APP1.REQUEST.LOCAL" in names, f"Missing Q.APP1.REQUEST.LOCAL in {names}"
    assert "Q.APP1.RESPONSE.LOCAL" in names, f"Missing Q.APP1.RESPONSE.LOCAL in {names}"
    assert "Q.SRCA.DLQ.LOCAL" in names, f"Missing Q.SRCA.DLQ.LOCAL in {names}"


def test_02_baseline_validation_passes(client):
    """Message flow works on source QM before migration."""
    r = client.post("/api/validate/flow", json={
        "app_id": "APP1",
        "qm_name": "QM.SRC.A",
        "queue_name": "Q.APP1.REQUEST.LOCAL",
        "phase": "BASELINE",
    })
    assert r.status_code == 200
    result = r.json()
    assert result.get("passed") is True, f"Baseline validation failed: {result}"
    assert result.get("latency_ms", 9999) < 5000


def test_03_trigger_migration(client):
    """POST /api/migration/execute starts APP1 migration."""
    # Reset to IDLE if already in a terminal state
    status_r = client.get("/api/migration/status")
    if status_r.status_code == 200:
        records = {m["app_id"]: m for m in status_r.json().get("migrations", [])}
        app1 = records.get("APP1", {})
        if app1.get("state") == "ROLLED_BACK":
            client.post("/api/migration/APP1/transition", json={"new_state": "IDLE"})

    r = client.post("/api/migration/execute", json={
        "app_id": "APP1",
        "source_qm": "QM.SRC.A",
        "target_qm": "QM.APP1",
    })
    assert r.status_code in (200, 202), f"Unexpected status {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("status") == "started", f"Unexpected body: {body}"


def test_04_migration_completes(client):
    """Poll until APP1 reaches MIGRATED or ROLLED_BACK (max 5 min)."""
    deadline = time.time() + 300
    while time.time() < deadline:
        r = client.get("/api/migration/status")
        assert r.status_code == 200
        records = {m["app_id"]: m for m in r.json().get("migrations", [])}
        app1 = records.get("APP1")
        if app1 and app1["state"] in ("MIGRATED", "ROLLED_BACK"):
            assert app1["state"] == "MIGRATED", (
                f"Migration rolled back: {app1.get('error')}"
            )
            return
        time.sleep(5)
    pytest.fail("APP1 migration did not complete within 5 minutes")


def test_05_target_qm_has_app1_queues(client):
    """After migration, queues exist on QM.APP1."""
    r = client.get("/api/queues", params={"qm": "QM.APP1"})
    assert r.status_code == 200
    names = [q["name"] for q in r.json().get("queues", [])]
    assert "Q.APP1.REQUEST.LOCAL" in names, f"Missing Q.APP1.REQUEST.LOCAL in {names}"
    assert "Q.APP1.DLQ.LOCAL" in names, f"Missing Q.APP1.DLQ.LOCAL in {names}"


def test_06_final_validation_passes(client):
    """Message flow works on target QM after migration."""
    r = client.post("/api/validate/flow", json={
        "app_id": "APP1",
        "qm_name": "QM.APP1",
        "queue_name": "Q.APP1.REQUEST.LOCAL",
        "phase": "FINAL",
    })
    assert r.status_code == 200
    result = r.json()
    assert result.get("passed") is True, f"Final validation failed: {result}"


def test_07_audit_trail_complete(client):
    """Audit log contains all expected operations."""
    r = client.get("/api/audit", params={"limit": 100})
    assert r.status_code == 200
    ops = {e["operation"] for e in r.json().get("events", [])}
    expected = {"CREATE_QUEUE", "VALIDATION", "CREATE_CHANNEL"}
    missing = expected - ops
    assert not missing, f"Missing audit operations: {missing}. Found: {ops}"


def test_08_migration_history_has_all_states(client):
    """
    Migration history shows REWIRING step occurred and terminal MIGRATED state.
    During the rewiring phase, remote def routes PUT to target QM.
    After cutover+cleanup, producer must reconnect directly to target.
    """
    r = client.get("/api/migration/APP1/history")
    assert r.status_code == 200
    states = [h["to_state"] for h in r.json().get("history", [])]
    assert "REWIRING" in states, f"REWIRING not in history: {states}"
    assert "VALIDATING" in states, f"VALIDATING not in history: {states}"
    assert "MIGRATED" in states, f"MIGRATED not in history: {states}"
