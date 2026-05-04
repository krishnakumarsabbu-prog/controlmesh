"""
Verify that APP1 (from QM.SRC.A) and APP4 (from QM.SRC.B) can migrate concurrently
without interfering with each other.

Run: pytest tests/integration/test_concurrent_migrations.py -v --tb=short
"""
import os
import asyncio
import time
import pytest
import httpx

BCL_URL = os.environ.get("BCL_URL", "http://bcl-gateway-svc:8000")


async def _reset_app_to_idle(client: httpx.AsyncClient, app_id: str) -> None:
    """Best-effort reset of an app to IDLE."""
    r = await client.get("/api/migration/status")
    if r.status_code != 200:
        return
    records = {m["app_id"]: m for m in r.json().get("migrations", [])}
    app = records.get(app_id, {})
    state = app.get("state", "IDLE")
    if state == "ROLLED_BACK":
        await client.post(f"/api/migration/{app_id}/transition", json={"new_state": "IDLE"})
    elif state not in ("IDLE", "MIGRATED"):
        # Force through rollback to get to a terminal state
        await client.post(f"/api/migration/{app_id}/rollback")
        await asyncio.sleep(5)


@pytest.mark.asyncio
async def test_concurrent_app1_app4():
    """
    APP1 (source: QM.SRC.A) and APP4 (source: QM.SRC.B) migrate simultaneously.
    Both must reach MIGRATED without interfering with each other.
    """
    async with httpx.AsyncClient(base_url=BCL_URL, timeout=300) as client:
        # Reset both apps to IDLE
        await asyncio.gather(
            _reset_app_to_idle(client, "APP1"),
            _reset_app_to_idle(client, "APP4"),
        )

        # Fire both migrations simultaneously
        r1, r4 = await asyncio.gather(
            client.post("/api/migration/execute", json={
                "app_id": "APP1",
                "source_qm": "QM.SRC.A",
                "target_qm": "QM.APP1",
            }),
            client.post("/api/migration/execute", json={
                "app_id": "APP4",
                "source_qm": "QM.SRC.B",
                "target_qm": "QM.APP4",
            }),
        )
        assert r1.status_code in (200, 202), f"APP1 execute failed: {r1.text}"
        assert r4.status_code in (200, 202), f"APP4 execute failed: {r4.text}"

        # Poll until both complete (max 6 min)
        deadline = time.time() + 360
        while time.time() < deadline:
            r = await client.get("/api/migration/status")
            assert r.status_code == 200
            records = {m["app_id"]: m for m in r.json().get("migrations", [])}
            app1_state = records.get("APP1", {}).get("state")
            app4_state = records.get("APP4", {}).get("state")
            terminal = {"MIGRATED", "ROLLED_BACK"}
            if app1_state in terminal and app4_state in terminal:
                assert app1_state == "MIGRATED", (
                    f"APP1 not migrated: {app1_state}, error: {records['APP1'].get('error')}"
                )
                assert app4_state == "MIGRATED", (
                    f"APP4 not migrated: {app4_state}, error: {records['APP4'].get('error')}"
                )
                return
            await asyncio.sleep(5)

        pytest.fail(
            "Concurrent migrations did not complete within 6 minutes. "
            f"APP1 state: {records.get('APP1', {}).get('state')}, "
            f"APP4 state: {records.get('APP4', {}).get('state')}"
        )


@pytest.mark.asyncio
async def test_concurrent_migrations_no_cross_contamination():
    """
    After concurrent migration, APP1 queues are on QM.APP1 and APP4 queues
    are on QM.APP4 — no cross-contamination between queue managers.
    """
    async with httpx.AsyncClient(base_url=BCL_URL, timeout=60) as client:
        r1 = await client.get("/api/queues", params={"qm": "QM.APP1"})
        r4 = await client.get("/api/queues", params={"qm": "QM.APP4"})

        assert r1.status_code == 200
        assert r4.status_code == 200

        app1_names = {q["name"] for q in r1.json().get("queues", [])}
        app4_names = {q["name"] for q in r4.json().get("queues", [])}

        assert "Q.APP1.REQUEST.LOCAL" in app1_names
        assert "Q.APP4.REQUEST.LOCAL" in app4_names

        # No APP4 queues on QM.APP1 and vice versa
        assert not any("APP4" in n for n in app1_names), (
            f"APP4 queues found on QM.APP1: {app1_names}"
        )
        assert not any("APP1" in n for n in app4_names), (
            f"APP1 queues found on QM.APP4: {app4_names}"
        )
