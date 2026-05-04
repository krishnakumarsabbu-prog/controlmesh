"""
Unit tests for the shared agent tool library.
MQ registry and Redis store are mocked so these tests run without live services.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ── audit_tools ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_log_audit_event_appends_to_store():
    mock_store = MagicMock()
    mock_store.append_audit = AsyncMock()

    with patch("bcl.agents.tools.audit_tools.RedisStore", return_value=mock_store):
        from bcl.agents.tools.audit_tools import log_audit_event
        result = await log_audit_event(
            operation="test_op",
            qm_target="QM.TEST",
            agent="test_agent",
            result="ok",
            trace_id="abc123",
            details={"key": "value"},
        )

    assert result == {"logged": True}
    mock_store.append_audit.assert_called_once()
    event = mock_store.append_audit.call_args[0][0]
    assert event["operation"] == "test_op"
    assert event["trace_id"] == "abc123"
    assert "timestamp" in event


# ── redis_tools ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_save_snapshot_returns_key():
    mock_store = MagicMock()
    mock_store.save_snapshot = AsyncMock(return_value="snapshot:APP1:pre_migration:123")

    with patch("bcl.agents.tools.redis_tools.RedisStore", return_value=mock_store):
        from bcl.agents.tools.redis_tools import save_snapshot
        key = await save_snapshot("APP1", "pre_migration", {"qm": "QM.SRC.A"})

    assert key == "snapshot:APP1:pre_migration:123"
    mock_store.save_snapshot.assert_called_once_with("APP1", "pre_migration", {"qm": "QM.SRC.A"})


@pytest.mark.asyncio
async def test_load_snapshot_returns_dict():
    expected = {"qm": "QM.SRC.A", "queues": []}
    mock_store = MagicMock()
    mock_store.load_latest_snapshot = AsyncMock(return_value=expected)

    with patch("bcl.agents.tools.redis_tools.RedisStore", return_value=mock_store):
        from bcl.agents.tools.redis_tools import load_snapshot
        result = await load_snapshot("APP1")

    assert result == expected


# ── mq_tools ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_queue_calls_client():
    mock_client = MagicMock()
    mock_client.create_queue = AsyncMock(return_value={})
    mock_qm = MagicMock(internal_name="QMSRCA", client=mock_client)
    mock_registry = MagicMock()
    mock_registry.get = MagicMock(return_value=mock_qm)

    with patch("bcl.agents.tools.mq_tools.get_registry", return_value=mock_registry), \
         patch("bcl.agents.tools.mq_tools.enforce_pre_operation", new=AsyncMock()):
        from bcl.agents.tools.mq_tools import create_queue
        result = await create_queue("QM.SRC.A", "APP1.REQUEST.Q", "LOCAL")

    assert result["status"] == "created"
    assert result["queue"] == "APP1.REQUEST.Q"
    mock_client.create_queue.assert_called_once()


@pytest.mark.asyncio
async def test_create_queue_respects_policy_rejection():
    from fastapi import HTTPException

    with patch("bcl.agents.tools.mq_tools.enforce_pre_operation",
               new=AsyncMock(side_effect=HTTPException(422, "naming violation"))):
        from bcl.agents.tools.mq_tools import create_queue
        with pytest.raises(HTTPException):
            await create_queue("QM.SRC.A", "bad_name", "LOCAL")
