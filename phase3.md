# Phase 3: Migration State Machine Implementation

**Duration:** 2–3 days
**Objective:** Design and implement the per-application migration state machine that governs the full lifecycle from source topology through to validated target topology, with automated rollback on failure.

---

## Context and Rationale

Each of the six applications has its own independent migration state machine. The state machine is the authoritative record of where each application is in its migration journey. It drives:
- What actions the BCL accepts for a given application
- What the UI displays in the migration console
- When rollback is triggered automatically
- What audit events are emitted

The state is persisted in Redis so it survives BCL pod restarts and is consistent across BCL replicas.

---

## State Machine Diagram

```
                    ┌─────────┐
                    │  IDLE   │  ← source topology active
                    └────┬────┘
                         │ POST /api/migration/execute
                         ▼
                  ┌────────────┐
                  │SNAPSHOTTED │  ← pre-step state saved to Redis
                  └─────┬──────┘
                         │ provisioning agent starts
                         ▼
               ┌──────────────────┐
               │PROVISIONING_TARGET│  ← new QM + DLQ created
               └────────┬─────────┘
                         │ target QM ready
                         ▼
                  ┌────────────┐
                  │  REWIRING  │  ← xmit queue + remote def active
                  └─────┬──────┘
                         │ rewiring complete
                         ▼
                  ┌────────────┐
                  │ VALIDATING │  ← put/get test in progress
                  └─────┬──────┘
                    pass │  │ fail
                         │  └────────────────────────┐
                         ▼                            ▼
                  ┌────────────┐              ┌──────────────┐
                  │  MIGRATED  │              │ ROLLING_BACK │
                  └────────────┘              └──────┬───────┘
                                                     │ rollback complete
                                                     ▼
                                              ┌──────────────┐
                                              │ ROLLED_BACK  │
                                              └──────────────┘
```

---

## State Definitions

| State | Description | Next Valid States |
|-------|-------------|-------------------|
| `IDLE` | Source topology active, no migration in progress | `SNAPSHOTTED` |
| `SNAPSHOTTED` | Pre-migration snapshot saved to Redis | `PROVISIONING_TARGET` |
| `PROVISIONING_TARGET` | Target QM being created with DLQ | `REWIRING`, `ROLLING_BACK` |
| `REWIRING` | Xmit queue and remote queue def being installed | `VALIDATING`, `ROLLING_BACK` |
| `VALIDATING` | Put/get flow test running | `MIGRATED`, `ROLLING_BACK` |
| `MIGRATED` | Application isolated on own QM, flows validated | (terminal) |
| `ROLLING_BACK` | Restoring from Redis snapshot | `ROLLED_BACK` |
| `ROLLED_BACK` | Source topology restored | `IDLE` (retry allowed) |

---

## Implementation

### 3.1 State Model

```python
# bcl/models/migration.py
from enum import Enum
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List

class MigrationState(str, Enum):
    IDLE = "IDLE"
    SNAPSHOTTED = "SNAPSHOTTED"
    PROVISIONING_TARGET = "PROVISIONING_TARGET"
    REWIRING = "REWIRING"
    VALIDATING = "VALIDATING"
    MIGRATED = "MIGRATED"
    ROLLING_BACK = "ROLLING_BACK"
    ROLLED_BACK = "ROLLED_BACK"

# Valid transitions
TRANSITIONS = {
    MigrationState.IDLE:                  [MigrationState.SNAPSHOTTED],
    MigrationState.SNAPSHOTTED:           [MigrationState.PROVISIONING_TARGET],
    MigrationState.PROVISIONING_TARGET:   [MigrationState.REWIRING,
                                           MigrationState.ROLLING_BACK],
    MigrationState.REWIRING:              [MigrationState.VALIDATING,
                                           MigrationState.ROLLING_BACK],
    MigrationState.VALIDATING:            [MigrationState.MIGRATED,
                                           MigrationState.ROLLING_BACK],
    MigrationState.MIGRATED:              [],  # terminal
    MigrationState.ROLLING_BACK:          [MigrationState.ROLLED_BACK],
    MigrationState.ROLLED_BACK:           [MigrationState.IDLE],
}

@dataclass
class MigrationRecord:
    app_id: str
    state: MigrationState = MigrationState.IDLE
    source_qm: str = ""
    target_qm: str = ""
    snapshot_key: str = ""
    started_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    error: Optional[str] = None
    history: List[dict] = field(default_factory=list)
    validation_results: List[dict] = field(default_factory=list)
```

---

### 3.2 State Machine Engine

```python
# bcl/state/state_machine.py
import structlog
from datetime import datetime, timezone
from models.migration import MigrationRecord, MigrationState, TRANSITIONS
from state.redis_store import RedisStore
from fastapi import HTTPException

log = structlog.get_logger()

class MigrationStateMachine:
    def __init__(self, redis_store: RedisStore):
        self.store = redis_store

    async def get(self, app_id: str) -> MigrationRecord:
        record = await self.store.get_migration_record(app_id)
        if record is None:
            record = MigrationRecord(app_id=app_id)
            await self.store.save_migration_record(record)
        return record

    async def transition(self, app_id: str,
                         new_state: MigrationState,
                         metadata: dict = None) -> MigrationRecord:
        record = await self.get(app_id)
        allowed = TRANSITIONS.get(record.state, [])

        if new_state not in allowed:
            raise HTTPException(status_code=409, detail={
                "error": "INVALID_TRANSITION",
                "current_state": record.state,
                "requested_state": new_state,
                "allowed_transitions": [s.value for s in allowed]
            })

        now = datetime.now(timezone.utc)
        record.history.append({
            "from_state": record.state,
            "to_state": new_state,
            "timestamp": now.isoformat(),
            "metadata": metadata or {}
        })

        log.info("state_transition",
                 app_id=app_id,
                 from_state=record.state,
                 to_state=new_state)

        record.state = new_state
        record.updated_at = now
        if new_state == MigrationState.SNAPSHOTTED:
            record.started_at = now

        if metadata:
            if "error" in metadata:
                record.error = metadata["error"]
            if "validation_result" in metadata:
                record.validation_results.append(metadata["validation_result"])

        await self.store.save_migration_record(record)
        await self._emit_sse_event(app_id, new_state, metadata)
        return record

    async def _emit_sse_event(self, app_id: str,
                              state: MigrationState, metadata: dict):
        """Push state change to SSE stream for UI real-time updates."""
        from state.redis_store import RedisStore
        store = RedisStore()
        await store.publish_sse_event({
            "event": "state_change",
            "app_id": app_id,
            "state": state.value,
            "metadata": metadata or {}
        })
```

---

### 3.3 Redis State Persistence

```python
# bcl/state/redis_store.py
import json, os, time
import aioredis
from dataclasses import asdict
from models.migration import MigrationRecord, MigrationState

class RedisStore:
    def __init__(self):
        self.url = os.environ["REDIS_URL"]
        self._redis = None

    async def _get_redis(self):
        if self._redis is None:
            self._redis = await aioredis.from_url(self.url)
        return self._redis

    # --- Migration state ---
    async def save_migration_record(self, record: MigrationRecord):
        r = await self._get_redis()
        await r.set(
            f"migration:{record.app_id}",
            json.dumps(asdict(record), default=str)
        )

    async def get_migration_record(self, app_id: str) -> MigrationRecord | None:
        r = await self._get_redis()
        raw = await r.get(f"migration:{app_id}")
        if raw is None:
            return None
        data = json.loads(raw)
        data["state"] = MigrationState(data["state"])
        return MigrationRecord(**data)

    async def list_migration_records(self) -> list:
        r = await self._get_redis()
        keys = await r.keys("migration:*")
        records = []
        for key in keys:
            raw = await r.get(key)
            if raw:
                data = json.loads(raw)
                data["state"] = MigrationState(data["state"])
                records.append(MigrationRecord(**data))
        return records

    # --- Topology snapshots (rollback checkpoints) ---
    async def save_snapshot(self, app_id: str, step: str,
                            topology: dict) -> str:
        r = await self._get_redis()
        key = f"snapshot:{app_id}:{step}:{int(time.time())}"
        await r.set(key, json.dumps(topology))
        await r.expire(key, 86400 * 7)  # 7-day TTL
        # Track latest snapshot key per app
        await r.set(f"snapshot:latest:{app_id}", key)
        return key

    async def load_latest_snapshot(self, app_id: str) -> dict | None:
        r = await self._get_redis()
        key = await r.get(f"snapshot:latest:{app_id}")
        if not key:
            return None
        raw = await r.get(key.decode())
        return json.loads(raw) if raw else None

    # --- SSE event stream ---
    async def publish_sse_event(self, event: dict):
        r = await self._get_redis()
        await r.publish("sse:migration", json.dumps(event))

    # --- Audit log ---
    async def append_audit(self, event: dict):
        r = await self._get_redis()
        event["timestamp"] = time.time()
        await r.zadd("audit:events", {json.dumps(event): event["timestamp"]})

    async def get_audit_events(self, limit: int = 100,
                               filter_operation=None,
                               filter_qm=None) -> list:
        r = await self._get_redis()
        raw = await r.zrevrange("audit:events", 0, limit - 1)
        events = [json.loads(e) for e in raw]
        if filter_operation:
            events = [e for e in events if e.get("operation") == filter_operation]
        if filter_qm:
            events = [e for e in events if e.get("qm_target") == filter_qm]
        return events
```

---

### 3.4 Migration Router

```python
# bcl/routers/migration.py
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from state.state_machine import MigrationStateMachine
from state.redis_store import RedisStore
from models.migration import MigrationState
import json, asyncio

router = APIRouter(tags=["migration"])
store = RedisStore()
sm = MigrationStateMachine(store)

class ExecuteMigrationRequest(BaseModel):
    app_id: str
    source_qm: str
    target_qm: str

@router.post("/migration/execute")
async def execute_migration(req: ExecuteMigrationRequest):
    """Trigger a migration step for one application.
    The BCL saves a snapshot then invokes the orchestrator agent."""
    from agents.orchestrator import run_migration_step
    from policy.engine import enforce_pre_operation

    # Policy check
    await enforce_pre_operation(
        {"type": "migrate", "app_id": req.app_id},
        req.source_qm
    )

    # Snapshot current topology
    record = await sm.get(req.app_id)
    if record.state not in (MigrationState.IDLE, MigrationState.ROLLED_BACK):
        raise HTTPException(400, detail=f"App {req.app_id} already in migration: {record.state}")

    snapshot = await _capture_topology_snapshot(req.source_qm)
    snapshot_key = await store.save_snapshot(req.app_id, "pre_migration", snapshot)

    # Transition to SNAPSHOTTED
    record = await sm.transition(req.app_id, MigrationState.SNAPSHOTTED,
                                  {"snapshot_key": snapshot_key})
    record.source_qm = req.source_qm
    record.target_qm = req.target_qm
    record.snapshot_key = snapshot_key
    await store.save_migration_record(record)

    # Fire-and-forget: orchestrator agent runs the migration
    asyncio.create_task(
        run_migration_step(req.app_id, req.source_qm, req.target_qm, snapshot_key)
    )

    return {"status": "started", "app_id": req.app_id,
            "state": record.state, "snapshot_key": snapshot_key}

@router.get("/migration/status")
async def get_migration_status():
    records = await store.list_migration_records()
    return {
        "migrations": [
            {
                "app_id": r.app_id,
                "state": r.state,
                "source_qm": r.source_qm,
                "target_qm": r.target_qm,
                "started_at": r.started_at,
                "updated_at": r.updated_at,
                "error": r.error,
                "validation_results": r.validation_results,
            }
            for r in records
        ]
    }

@router.get("/migration/{app_id}/history")
async def get_migration_history(app_id: str):
    record = await sm.get(app_id)
    return {"app_id": app_id, "history": record.history}

@router.get("/migration/stream")
async def migration_stream():
    """SSE stream for real-time UI updates."""
    async def event_generator():
        import aioredis
        r = await aioredis.from_url(store.url)
        pubsub = r.pubsub()
        await pubsub.subscribe("sse:migration")
        async for message in pubsub.listen():
            if message["type"] == "message":
                data = message["data"].decode()
                yield f"data: {data}\n\n"

    return StreamingResponse(event_generator(),
                             media_type="text/event-stream")

async def _capture_topology_snapshot(qm_name: str) -> dict:
    from mq.registry import get_registry
    registry = get_registry()
    qm = registry.get(qm_name)
    # Capture queues and channels for rollback
    queues = await qm.client.get_qmgr_status()
    return {"qm": qm_name, "queues": queues, "captured_at": str(__import__("datetime").datetime.utcnow())}
```

---

## Recovery Mechanisms

### Crash Recovery

If the BCL pod crashes mid-migration, the state machine picks up where it left off on restart:

```python
# bcl/startup.py
async def recover_in_progress_migrations():
    """On startup, resume any migrations stuck in transitional states."""
    store = RedisStore()
    sm = MigrationStateMachine(store)
    records = await store.list_migration_records()

    for record in records:
        if record.state in (MigrationState.PROVISIONING_TARGET,
                            MigrationState.REWIRING,
                            MigrationState.VALIDATING):
            # Stuck in-progress — trigger rollback for safety
            await sm.transition(record.app_id, MigrationState.ROLLING_BACK,
                                {"error": "BCL restarted during migration — auto-rollback"})
            # Rollback agent will handle restoration
            from agents.rollback import run_rollback
            asyncio.create_task(run_rollback(record.app_id))
```

---

## Testing

```python
# bcl/tests/test_state_machine.py
import pytest
from unittest.mock import AsyncMock
from state.state_machine import MigrationStateMachine
from models.migration import MigrationState

@pytest.mark.asyncio
async def test_valid_transition():
    store = AsyncMock()
    store.get_migration_record.return_value = None
    sm = MigrationStateMachine(store)
    record = await sm.get("APP1")
    assert record.state == MigrationState.IDLE

@pytest.mark.asyncio
async def test_invalid_transition_raises():
    from fastapi import HTTPException
    store = AsyncMock()
    store.get_migration_record.return_value = None
    sm = MigrationStateMachine(store)
    with pytest.raises(HTTPException) as exc:
        await sm.transition("APP1", MigrationState.MIGRATED)
    assert exc.value.status_code == 409

@pytest.mark.asyncio
async def test_rollback_from_validating():
    store = AsyncMock()
    record_mock = __import__("models.migration", fromlist=["MigrationRecord"])
    from models.migration import MigrationRecord, MigrationState
    store.get_migration_record.return_value = MigrationRecord(
        app_id="APP1", state=MigrationState.VALIDATING
    )
    sm = MigrationStateMachine(store)
    result = await sm.transition("APP1", MigrationState.ROLLING_BACK,
                                 {"error": "validation failed"})
    assert result.state == MigrationState.ROLLING_BACK
```

---

## Success Criteria

| Criterion | Verification |
|-----------|-------------|
| All 8 states persisted in Redis | `redis-cli get migration:APP1` shows correct state |
| Invalid transitions rejected with 409 | Unit test coverage |
| Snapshot captured before each migration | `redis-cli keys "snapshot:*"` |
| SSE stream pushes state changes | Browser EventSource receives events |
| Crash recovery rolls back in-progress | Simulate pod restart mid-migration |
| Audit log records all transitions | `GET /api/audit` shows history |
