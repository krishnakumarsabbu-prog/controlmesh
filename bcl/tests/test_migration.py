"""
Tests for Phase 3 migration state machine.
Run: pytest bcl/tests/test_migration.py -v
"""
import sys
import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../.."))

from bcl.models.migration import (
    MigrationRecord,
    MigrationState,
    TRANSITIONS,
    IN_PROGRESS_STATES,
)


# ── Model tests ───────────────────────────────────────────────────────────────

def test_default_state_is_idle():
    record = MigrationRecord(app_id="APP1")
    assert record.state == MigrationState.IDLE


def test_transitions_table_complete():
    for state in MigrationState:
        assert state in TRANSITIONS, f"{state} missing from TRANSITIONS"


def test_in_progress_states_are_subset_of_transitions():
    for state in IN_PROGRESS_STATES:
        assert state in TRANSITIONS


def test_migrated_is_terminal():
    assert TRANSITIONS[MigrationState.MIGRATED] == []


# ── State machine tests ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_creates_idle_record_when_missing():
    from bcl.state.state_machine import MigrationStateMachine

    store = AsyncMock()
    store.get_migration_record.return_value = None
    store.save_migration_record.return_value = None
    store.publish_sse_event.return_value = None

    sm = MigrationStateMachine(store)
    record = await sm.get("APP1")

    assert record.app_id == "APP1"
    assert record.state == MigrationState.IDLE
    store.save_migration_record.assert_called_once()


@pytest.mark.asyncio
async def test_valid_transition_idle_to_snapshotted():
    from bcl.state.state_machine import MigrationStateMachine

    store = AsyncMock()
    store.get_migration_record.return_value = MigrationRecord(app_id="APP1")
    store.save_migration_record.return_value = None
    store.publish_sse_event.return_value = None

    sm = MigrationStateMachine(store)
    result = await sm.transition("APP1", MigrationState.SNAPSHOTTED)

    assert result.state == MigrationState.SNAPSHOTTED
    assert result.started_at is not None
    assert len(result.history) == 1
    assert result.history[0]["from_state"] == MigrationState.IDLE


@pytest.mark.asyncio
async def test_invalid_transition_raises_409():
    from bcl.state.state_machine import MigrationStateMachine
    from fastapi import HTTPException

    store = AsyncMock()
    store.get_migration_record.return_value = MigrationRecord(app_id="APP1")
    store.save_migration_record.return_value = None

    sm = MigrationStateMachine(store)

    with pytest.raises(HTTPException) as exc_info:
        await sm.transition("APP1", MigrationState.MIGRATED)

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail["error"] == "INVALID_TRANSITION"


@pytest.mark.asyncio
async def test_rollback_from_validating():
    from bcl.state.state_machine import MigrationStateMachine

    store = AsyncMock()
    store.get_migration_record.return_value = MigrationRecord(
        app_id="APP1", state=MigrationState.VALIDATING
    )
    store.save_migration_record.return_value = None
    store.publish_sse_event.return_value = None

    sm = MigrationStateMachine(store)
    result = await sm.transition(
        "APP1", MigrationState.ROLLING_BACK, {"error": "validation failed"}
    )

    assert result.state == MigrationState.ROLLING_BACK
    assert result.error == "validation failed"


@pytest.mark.asyncio
async def test_metadata_persisted_on_transition():
    from bcl.state.state_machine import MigrationStateMachine

    store = AsyncMock()
    store.get_migration_record.return_value = MigrationRecord(app_id="APP1")
    store.save_migration_record.return_value = None
    store.publish_sse_event.return_value = None

    sm = MigrationStateMachine(store)
    result = await sm.transition(
        "APP1",
        MigrationState.SNAPSHOTTED,
        {"snapshot_key": "snapshot:APP1:pre_migration:12345", "source_qm": "QM.SRC.A"},
    )

    assert result.snapshot_key == "snapshot:APP1:pre_migration:12345"
    assert result.source_qm == "QM.SRC.A"


@pytest.mark.asyncio
async def test_sse_event_published_on_transition():
    from bcl.state.state_machine import MigrationStateMachine

    store = AsyncMock()
    store.get_migration_record.return_value = MigrationRecord(app_id="APP2")
    store.save_migration_record.return_value = None
    store.publish_sse_event.return_value = None

    sm = MigrationStateMachine(store)
    await sm.transition("APP2", MigrationState.SNAPSHOTTED)

    store.publish_sse_event.assert_called_once()
    event = store.publish_sse_event.call_args[0][0]
    assert event["event"] == "state_change"
    assert event["app_id"] == "APP2"
    assert event["state"] == MigrationState.SNAPSHOTTED.value


@pytest.mark.asyncio
async def test_full_happy_path_transition_chain():
    from bcl.state.state_machine import MigrationStateMachine

    store = AsyncMock()
    store.save_migration_record.return_value = None
    store.publish_sse_event.return_value = None

    record = MigrationRecord(app_id="APP3")

    def side_effect(app_id):
        return record

    store.get_migration_record.side_effect = side_effect

    sm = MigrationStateMachine(store)

    states = [
        MigrationState.SNAPSHOTTED,
        MigrationState.PROVISIONING_TARGET,
        MigrationState.REWIRING,
        MigrationState.VALIDATING,
        MigrationState.MIGRATED,
    ]

    for state in states:
        record = await sm.transition("APP3", state)
        assert record.state == state


@pytest.mark.asyncio
async def test_rolled_back_can_retry_idle():
    from bcl.state.state_machine import MigrationStateMachine

    store = AsyncMock()
    store.get_migration_record.return_value = MigrationRecord(
        app_id="APP4", state=MigrationState.ROLLED_BACK
    )
    store.save_migration_record.return_value = None
    store.publish_sse_event.return_value = None

    sm = MigrationStateMachine(store)
    result = await sm.transition("APP4", MigrationState.IDLE)
    assert result.state == MigrationState.IDLE
