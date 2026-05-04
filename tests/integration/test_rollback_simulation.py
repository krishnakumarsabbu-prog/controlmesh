"""
Evidence test: proves automated rollback when validation is forced to fail.

We target APP2 and direct it at an intentionally invalid target QM so the
BCL's validation or provisioning step fails and the state machine transitions
to ROLLED_BACK automatically.

Run: pytest tests/integration/test_rollback_simulation.py -v --tb=short
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


def _reset_app2_to_idle(client: httpx.Client) -> None:
    """Best-effort reset of APP2 to IDLE so the test is idempotent."""
    r = client.get("/api/migration/status")
    if r.status_code != 200:
        return
    records = {m["app_id"]: m for m in r.json().get("migrations", [])}
    app2 = records.get("APP2", {})
    state = app2.get("state", "IDLE")
    if state == "ROLLED_BACK":
        client.post("/api/migration/APP2/transition", json={"new_state": "IDLE"})
    elif state not in ("IDLE",):
        # If stuck in a non-terminal in-progress state, force through rollback path
        client.post("/api/migration/APP2/rollback")
        time.sleep(3)
        client.post("/api/migration/APP2/transition", json={"new_state": "IDLE"})


def test_01_inject_failure_and_trigger_migration(client):
    """
    Trigger APP2 migration with an intentionally wrong target QM.
    QM.APP2.BROKEN does not exist, so provisioning or validation will fail,
    causing the state machine to transition to ROLLING_BACK → ROLLED_BACK.
    """
    _reset_app2_to_idle(client)

    r = client.post("/api/migration/execute", json={
        "app_id": "APP2",
        "source_qm": "QM.SRC.A",
        "target_qm": "QM.APP2.BROKEN",  # intentionally invalid target
    })
    # May be accepted (202) or immediately rejected by policy (400)
    assert r.status_code in (200, 202, 400), (
        f"Unexpected status {r.status_code}: {r.text}"
    )


def test_02_rolled_back_state_reached(client):
    """APP2 should reach ROLLED_BACK after the validation or provisioning failure."""
    deadline = time.time() + 300
    while time.time() < deadline:
        r = client.get("/api/migration/status")
        assert r.status_code == 200
        records = {m["app_id"]: m for m in r.json().get("migrations", [])}
        app2 = records.get("APP2")
        if app2 and app2["state"] in ("ROLLED_BACK", "MIGRATED"):
            assert app2["state"] == "ROLLED_BACK", (
                "Expected rollback but migration somehow succeeded with broken target"
            )
            return
        time.sleep(5)
    pytest.fail("APP2 did not reach ROLLED_BACK within 5 minutes")


def test_03_source_topology_restored(client):
    """After rollback, APP2 queues are still reachable on QM.SRC.A."""
    r = client.get("/api/queues", params={"qm": "QM.SRC.A"})
    assert r.status_code == 200
    names = [q["name"] for q in r.json().get("queues", [])]
    assert "Q.APP2.REQUEST.LOCAL" in names, (
        f"Q.APP2.REQUEST.LOCAL missing after rollback. Present: {names}"
    )


def test_04_source_flow_works_after_rollback(client):
    """Messages flow on QM.SRC.A after rollback."""
    r = client.post("/api/validate/flow", json={
        "app_id": "APP2",
        "qm_name": "QM.SRC.A",
        "queue_name": "Q.APP2.REQUEST.LOCAL",
        "phase": "BASELINE",
    })
    assert r.status_code == 200
    result = r.json()
    assert result.get("passed") is True, f"Post-rollback validation failed: {result}"


def test_05_rollback_signals_correct(client):
    """API, health, and audit signals all indicate ROLLED_BACK."""
    r_status = client.get("/api/migration/status")
    assert r_status.status_code == 200
    records = {m["app_id"]: m for m in r_status.json().get("migrations", [])}
    assert records["APP2"]["state"] == "ROLLED_BACK"

    r_health = client.get("/healthz/ready")
    assert r_health.status_code == 200

    r_audit = client.get("/api/audit", params={"limit": 50})
    assert r_audit.status_code == 200
    ops = [e["operation"] for e in r_audit.json().get("events", [])]
    assert any("ROLLBACK" in op.upper() for op in ops), (
        f"No ROLLBACK operation in audit: {ops}"
    )


def test_06_app2_can_be_retried_after_rollback(client):
    """Verify APP2 transitions back to IDLE from ROLLED_BACK for retry."""
    r = client.post("/api/migration/APP2/transition", json={"new_state": "IDLE"})
    assert r.status_code == 200
    body = r.json()
    assert body.get("state") in ("IDLE", "idle"), f"Unexpected state: {body}"
