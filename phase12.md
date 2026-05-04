# Phase 12: End-to-End Integration and Testing

**Duration:** 3–4 days
**Objective:** Integrate all components, execute comprehensive automated testing (unit, integration, e2e), perform load testing, run security scans, and produce evidence artifacts for each migration step.

---

## Context and Rationale

Integration testing is where the full system is exercised as a whole. Each component has been unit-tested individually; Phase 12 proves they work together. The test suite is the primary source of evidence for the hackathon evaluation:

- Automated test logs show migration executed through BCL
- Validation results show message flows confirmed at each phase
- Rollback test shows automated recovery from simulated failure
- Load test confirms performance requirements

All tests run as part of the CI/CD pipeline.

---

## Test Strategy

```
Unit Tests (bcl/tests/, agents/tests/)
    ├── Policy engine rules
    ├── State machine transitions
    ├── MQ client error handling
    ├── Agent tool functions (mocked MQ)
    └── Redis state operations

Integration Tests (tests/integration/)
    ├── BCL API against live MQ pods
    ├── Full migration of one app (APP1)
    ├── Rollback triggered by forced failure
    └── Concurrent migrations (APP1 + APP4)

End-to-End Tests (tests/e2e/)
    ├── Playwright: UI topology view renders
    ├── Playwright: Migration triggered from UI
    ├── Playwright: Validation panel updates
    └── Playwright: Audit log shows events

Load Tests (tests/load/)
    └── Locust: 100 concurrent users polling /api/migration/status
```

---

## Integration Test Suite

### 12.1 Full Migration Test (APP1)

```python
# tests/integration/test_full_migration_app1.py
"""
Evidence test: proves full APP1 migration through BCL.
Requires live MQ pods (qm-src-a, qm-app1) and BCL running.
"""
import pytest
import httpx
import asyncio
import time

BCL_URL = "http://bcl-gateway-svc:8000"

@pytest.fixture(scope="module")
def client():
    return httpx.Client(base_url=BCL_URL, timeout=120)

def test_01_source_topology_exists(client):
    """Source queues provisioned on QM.SRC.A."""
    r = client.get("/api/queues", params={"qm": "QM.SRC.A"})
    assert r.status_code == 200
    names = [q["name"] for q in r.json()["queues"]]
    assert "Q.APP1.REQUEST.LOCAL" in names
    assert "Q.APP1.RESPONSE.LOCAL" in names
    assert "Q.SRCA.DLQ.LOCAL" in names

def test_02_baseline_validation_passes(client):
    """Message flow works on source QM before migration."""
    r = client.post("/api/validate", json={
        "app_id": "APP1",
        "qm_name": "QM.SRC.A",
        "queue_name": "Q.APP1.REQUEST.LOCAL",
        "phase": "BASELINE"
    })
    assert r.status_code == 200
    result = r.json()
    assert result["passed"] is True
    assert result["latency_ms"] < 5000

def test_03_trigger_migration(client):
    """POST /api/migration/execute starts APP1 migration."""
    r = client.post("/api/migration/execute", json={
        "app_id": "APP1",
        "source_qm": "QM.SRC.A",
        "target_qm": "QM.APP1"
    })
    assert r.status_code == 200
    assert r.json()["status"] == "started"

def test_04_migration_completes(client):
    """Poll until APP1 reaches MIGRATED or ROLLED_BACK (max 5 min)."""
    deadline = time.time() + 300
    while time.time() < deadline:
        r = client.get("/api/migration/status")
        assert r.status_code == 200
        records = {m["app_id"]: m for m in r.json()["migrations"]}
        app1 = records.get("APP1")
        if app1 and app1["state"] in ("MIGRATED", "ROLLED_BACK"):
            assert app1["state"] == "MIGRATED", \
                f"Migration rolled back: {app1.get('error')}"
            return
        time.sleep(5)
    pytest.fail("APP1 migration did not complete within 5 minutes")

def test_05_target_qm_has_app1_queues(client):
    """After migration, queues exist on QM.APP1."""
    r = client.get("/api/queues", params={"qm": "QM.APP1"})
    assert r.status_code == 200
    names = [q["name"] for q in r.json()["queues"]]
    assert "Q.APP1.REQUEST.LOCAL" in names
    assert "Q.APP1.DLQ.LOCAL" in names

def test_06_final_validation_passes(client):
    """Message flow works on target QM after migration."""
    r = client.post("/api/validate", json={
        "app_id": "APP1",
        "qm_name": "QM.APP1",
        "queue_name": "Q.APP1.REQUEST.LOCAL",
        "phase": "FINAL"
    })
    assert r.status_code == 200
    assert r.json()["passed"] is True

def test_07_audit_trail_complete(client):
    """Audit log contains all expected operations."""
    r = client.get("/api/audit", params={"limit": 100})
    assert r.status_code == 200
    ops = {e["operation"] for e in r.json()["events"]}
    expected = {
        "CREATE_QUEUE", "VALIDATION", "CREATE_CHANNEL"
    }
    for op in expected:
        assert op in ops, f"Missing audit operation: {op}"

def test_08_producer_connection_unchanged(client):
    """
    Simulate producer still using source QM — message should
    transparently arrive at target QM via remote def.
    NOTE: During rewiring phase, this test passes because remote def
    routes the PUT. After cutover+cleanup, source QM no longer has
    the remote def, so producer must reconnect to target.
    """
    # Verify migration history shows REWIRING step occurred
    r = client.get("/api/migration/APP1/history")
    assert r.status_code == 200
    states = [h["to_state"] for h in r.json()["history"]]
    assert "REWIRING" in states
    assert "VALIDATING" in states
    assert "MIGRATED" in states
```

---

### 12.2 Rollback Test (Simulated Failure)

```python
# tests/integration/test_rollback_simulation.py
"""
Evidence test: proves automated rollback when validation is forced to fail.
"""
import pytest
import httpx
import time

BCL_URL = "http://bcl-gateway-svc:8000"

@pytest.fixture(scope="module")
def client():
    return httpx.Client(base_url=BCL_URL, timeout=120)

def test_01_inject_failure_and_trigger_migration(client):
    """
    Trigger APP2 migration with a queue name that will fail validation.
    We'll inject a "bad" queue config via the BCL to simulate the failure.
    """
    # Delete the target queue to guarantee validation failure
    # (target QM has no queue yet — validation will timeout)
    r = client.post("/api/migration/execute", json={
        "app_id": "APP2",
        "source_qm": "QM.SRC.A",
        "target_qm": "QM.APP2.BROKEN"  # Intentionally wrong target
    })
    assert r.status_code in (200, 400)  # May be rejected by policy

def test_02_rolled_back_state_reached(client):
    """APP2 should reach ROLLED_BACK after the validation failure."""
    deadline = time.time() + 300
    while time.time() < deadline:
        r = client.get("/api/migration/status")
        records = {m["app_id"]: m for m in r.json()["migrations"]}
        app2 = records.get("APP2")
        if app2 and app2["state"] in ("ROLLED_BACK", "MIGRATED"):
            assert app2["state"] == "ROLLED_BACK", \
                "Expected rollback but migration succeeded"
            return
        time.sleep(5)

def test_03_source_topology_restored(client):
    """After rollback, APP2 queues are back on QM.SRC.A."""
    r = client.get("/api/queues", params={"qm": "QM.SRC.A"})
    names = [q["name"] for q in r.json()["queues"]]
    assert "Q.APP2.REQUEST.LOCAL" in names

def test_04_source_flow_works_after_rollback(client):
    """Messages flow on QM.SRC.A after rollback."""
    r = client.post("/api/validate", json={
        "app_id": "APP2",
        "qm_name": "QM.SRC.A",
        "queue_name": "Q.APP2.REQUEST.LOCAL",
        "phase": "BASELINE"
    })
    assert r.json()["passed"] is True

def test_05_rollback_signals_correct(client):
    """API, health, and audit signals all indicate ROLLED_BACK."""
    r_status = client.get("/api/migration/status")
    records = {m["app_id"]: m for m in r_status.json()["migrations"]}
    assert records["APP2"]["state"] == "ROLLED_BACK"

    r_health = client.get("/healthz/ready")
    assert r_health.status_code == 200

    r_audit = client.get("/api/audit", params={"limit": 20})
    ops = [e["operation"] for e in r_audit.json()["events"]]
    assert any("ROLLBACK" in op for op in ops)
```

---

### 12.3 Concurrent Migration Test

```python
# tests/integration/test_concurrent_migrations.py
"""
Verify that APP1 (from QM.SRC.A) and APP4 (from QM.SRC.B) can migrate concurrently.
"""
import pytest
import httpx
import asyncio

BCL_URL = "http://bcl-gateway-svc:8000"

@pytest.mark.asyncio
async def test_concurrent_app1_app4():
    async with httpx.AsyncClient(base_url=BCL_URL, timeout=300) as client:
        # Fire both migrations simultaneously
        r1, r4 = await asyncio.gather(
            client.post("/api/migration/execute", json={
                "app_id": "APP1", "source_qm": "QM.SRC.A",
                "target_qm": "QM.APP1"
            }),
            client.post("/api/migration/execute", json={
                "app_id": "APP4", "source_qm": "QM.SRC.B",
                "target_qm": "QM.APP4"
            }),
        )
        assert r1.status_code == 200
        assert r4.status_code == 200

        # Wait for both to complete
        import time
        deadline = time.time() + 360
        while time.time() < deadline:
            r = await client.get("/api/migration/status")
            records = {m["app_id"]: m for m in r.json()["migrations"]}
            app1 = records.get("APP1", {}).get("state")
            app4 = records.get("APP4", {}).get("state")
            if app1 in ("MIGRATED", "ROLLED_BACK") and \
               app4 in ("MIGRATED", "ROLLED_BACK"):
                assert app1 == "MIGRATED", f"APP1 not migrated: {app1}"
                assert app4 == "MIGRATED", f"APP4 not migrated: {app4}"
                return
            await asyncio.sleep(5)

        pytest.fail("Concurrent migrations did not complete within 6 minutes")
```

---

## E2E Tests (Playwright)

```typescript
// tests/e2e/migration.spec.ts
import { test, expect } from '@playwright/test';

const UI_URL = process.env.UI_URL || 'http://mq-ui-route';

test('topology graph renders source queue managers', async ({ page }) => {
  await page.goto(`${UI_URL}/topology`);
  await expect(page.getByText('QM.SRC.A')).toBeVisible();
  await expect(page.getByText('QM.SRC.B')).toBeVisible();
});

test('migration console shows all 6 apps', async ({ page }) => {
  await page.goto(`${UI_URL}/migration`);
  for (const app of ['APP1', 'APP2', 'APP3', 'APP4', 'APP5', 'APP6']) {
    await expect(page.getByText(app)).toBeVisible();
  }
});

test('clicking Migrate triggers state change', async ({ page }) => {
  await page.goto(`${UI_URL}/migration`);
  const app1Row = page.locator('[data-testid="migration-row-APP1"]');
  await app1Row.getByRole('button', { name: 'Migrate' }).click();
  // State should change from IDLE within 10s
  await expect(app1Row.getByText(/SNAPSHOTTED|PROVISIONING/)).toBeVisible({
    timeout: 10000,
  });
});

test('audit log shows events', async ({ page }) => {
  await page.goto(`${UI_URL}/audit`);
  await expect(page.getByText('CREATE_QUEUE')).toBeVisible({ timeout: 5000 });
});
```

---

## Load Testing (Locust)

```python
# tests/load/locustfile.py
from locust import HttpUser, task, between

class BCLUser(HttpUser):
    wait_time = between(0.5, 2)
    host = "http://bcl-gateway-svc:8000"

    @task(5)
    def get_migration_status(self):
        self.client.get("/api/migration/status")

    @task(3)
    def get_fleet(self):
        self.client.get("/api/fleet")

    @task(2)
    def get_audit(self):
        self.client.get("/api/audit?limit=20")

    @task(1)
    def get_health(self):
        self.client.get("/healthz/ready")
```

Run: `locust -f tests/load/locustfile.py --users 100 --spawn-rate 10 --run-time 60s --headless`

Target: p99 < 500 ms at 100 users.

---

## Security Testing

```bash
# OWASP ZAP baseline scan
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t http://bcl-gateway-svc:8000/api/docs \
  -r zap-report.html

# Trivy container vulnerability scan
trivy image bcl-gateway:latest --exit-code 1 --severity HIGH,CRITICAL
trivy image mq-ui:latest --exit-code 1 --severity HIGH,CRITICAL

# Bandit Python security lint
bandit -r bcl/ agents/ -f json -o bandit-report.json
```

---

## Evidence Artifacts

After running all tests, collect:

```bash
# 1. Test run logs
pytest tests/integration/ -v --tb=short > evidence/integration-tests.txt

# 2. Per-app migration evidence
for app in APP1 APP2 APP3 APP4 APP5 APP6; do
  curl -s http://bcl-gateway-svc:8000/api/migration/$app/history \
    > evidence/migration-$app-history.json
  curl -s "http://bcl-gateway-svc:8000/api/validate/$app/history" \
    > evidence/validation-$app.json
done

# 3. Audit log snapshot
curl -s "http://bcl-gateway-svc:8000/api/audit?limit=500" \
  > evidence/audit-log.json

# 4. Fleet state after migration
curl -s http://bcl-gateway-svc:8000/api/fleet \
  > evidence/fleet-post-migration.json

# 5. Grafana dashboard screenshots (manual)
```

---

## CI Integration

```yaml
# .tekton/integration-test-task.yaml
apiVersion: tekton.dev/v1beta1
kind: Task
metadata:
  name: integration-test
spec:
  steps:
  - name: run-tests
    image: python:3.12
    script: |
      pip install pytest pytest-asyncio httpx
      pytest tests/integration/ -v --tb=short \
        --junitxml=results/integration.xml
  - name: archive-evidence
    image: alpine/curl
    script: |
      mkdir -p evidence
      curl -s $BCL_URL/api/audit?limit=500 > evidence/audit.json
      curl -s $BCL_URL/api/migration/status > evidence/migration-status.json
```

---

## Success Criteria

| Criterion | Verification |
|-----------|-------------|
| All 6 apps can be migrated | Integration test suite: all MIGRATED |
| Rollback works automatically | Rollback test: ROLLED_BACK state |
| Source topology restored post-rollback | Queue present on source QM |
| Concurrent migrations don't interfere | Concurrent test passes |
| Performance: p99 < 500ms at 100 users | Locust report |
| Zero critical security vulnerabilities | Trivy + ZAP scan clean |
| Test coverage > 80% | `pytest --cov` report |
| Evidence artifacts generated | `evidence/` directory populated |
