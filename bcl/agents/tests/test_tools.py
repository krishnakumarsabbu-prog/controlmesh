"""
Unit tests for the shared agent tool library.
MQ registry and Redis store are mocked so these tests run without live services.
"""
import sys
import types
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


def _install_aioredis_stub():
    if "aioredis" not in sys.modules:
        stub = types.ModuleType("aioredis")
        stub.Redis = MagicMock
        stub.from_url = AsyncMock(return_value=MagicMock())
        stub.StrictRedis = MagicMock
        sys.modules["aioredis"] = stub


_install_aioredis_stub()


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


# ── migration tools ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_diff_topology_returns_queues_to_move():
    import httpx

    source_response = MagicMock()
    source_response.status_code = 200
    source_response.json.return_value = {
        "queue": [{"name": "Q.APP1.REQUEST.LOCAL"}, {"name": "Q.APP1.REPLY.LOCAL"}]
    }
    source_response.raise_for_status = MagicMock()

    target_response = MagicMock()
    target_response.status_code = 200
    target_response.json.return_value = {"queue": []}

    mock_http_client = AsyncMock()
    mock_http_client.get = AsyncMock(side_effect=[source_response, target_response])

    mock_source_client = MagicMock()
    mock_source_client._get_client.return_value = mock_http_client
    mock_source_client.auth = ("admin", "pass")

    mock_target_client = MagicMock()
    mock_target_client._get_client.return_value = mock_http_client
    mock_target_client.auth = ("admin", "pass")

    mock_source_qm = MagicMock(
        internal_name="QMSRCA",
        svc_url="https://qm-src-a-svc:9443",
        client=mock_source_client,
    )
    mock_target_qm = MagicMock(
        internal_name="QMAPP1",
        svc_url="https://qm-app1-svc:9443",
        client=mock_target_client,
    )

    mock_registry = MagicMock()
    mock_registry.get = MagicMock(side_effect=lambda name: {
        "QM.SRC.A": mock_source_qm,
        "QM.APP1": mock_target_qm,
    }[name])

    with patch("bcl.agents.tools.mq_tools.get_registry", return_value=mock_registry):
        from bcl.agents.tools.mq_tools import diff_topology
        result = await diff_topology("QM.SRC.A", "QM.APP1", "APP1")

    assert result["action_required"] is True
    assert "Q.APP1.REQUEST.LOCAL" in result["queues_to_move"]
    assert "Q.APP1.REPLY.LOCAL" in result["queues_to_move"]


@pytest.mark.asyncio
async def test_diff_topology_excludes_dlq():
    source_response = MagicMock()
    source_response.status_code = 200
    source_response.json.return_value = {
        "queue": [
            {"name": "Q.APP1.REQUEST.LOCAL"},
            {"name": "Q.APP1.DLQ.LOCAL"},
        ]
    }
    source_response.raise_for_status = MagicMock()

    target_response = MagicMock()
    target_response.status_code = 200
    target_response.json.return_value = {"queue": []}

    mock_http_client = AsyncMock()
    mock_http_client.get = AsyncMock(side_effect=[source_response, target_response])

    mock_client = MagicMock()
    mock_client._get_client.return_value = mock_http_client
    mock_client.auth = ("admin", "pass")

    mock_qm = MagicMock(
        internal_name="QMSRCA",
        svc_url="https://qm-src-a-svc:9443",
        client=mock_client,
    )

    mock_registry = MagicMock()
    mock_registry.get = MagicMock(return_value=mock_qm)

    with patch("bcl.agents.tools.mq_tools.get_registry", return_value=mock_registry):
        from bcl.agents.tools.mq_tools import diff_topology
        result = await diff_topology("QM.SRC.A", "QM.APP1", "APP1")

    assert "Q.APP1.DLQ.LOCAL" not in result["queues_to_move"]
    assert "Q.APP1.REQUEST.LOCAL" in result["queues_to_move"]


@pytest.mark.asyncio
async def test_create_sender_channel_calls_client():
    mock_client = MagicMock()
    mock_client.create_channel = AsyncMock(return_value={})
    mock_qm = MagicMock(internal_name="QMSRCA", client=mock_client)
    mock_registry = MagicMock()
    mock_registry.get = MagicMock(return_value=mock_qm)

    with patch("bcl.agents.tools.mq_tools.get_registry", return_value=mock_registry), \
         patch("bcl.agents.tools.mq_tools.enforce_pre_operation", new=AsyncMock()):
        from bcl.agents.tools.mq_tools import create_sender_channel
        result = await create_sender_channel(
            "QM.SRC.A", "CHL.SRCA.APP1", "qm-app1-svc", 1414
        )

    assert result["status"] == "created"
    assert result["type"] == "SDR"
    mock_client.create_channel.assert_called_once()
    call_props = mock_client.create_channel.call_args[0][2]
    assert call_props["type"] == "SDR"
    assert "qm-app1-svc(1414)" in call_props["connectionName"]


@pytest.mark.asyncio
async def test_create_receiver_channel_calls_client():
    mock_client = MagicMock()
    mock_client.create_channel = AsyncMock(return_value={})
    mock_qm = MagicMock(internal_name="QMAPP1", client=mock_client)
    mock_registry = MagicMock()
    mock_registry.get = MagicMock(return_value=mock_qm)

    with patch("bcl.agents.tools.mq_tools.get_registry", return_value=mock_registry), \
         patch("bcl.agents.tools.mq_tools.enforce_pre_operation", new=AsyncMock()):
        from bcl.agents.tools.mq_tools import create_receiver_channel
        result = await create_receiver_channel("QM.APP1", "CHL.SRCA.APP1")

    assert result["status"] == "created"
    assert result["type"] == "RCVR"
    call_props = mock_client.create_channel.call_args[0][2]
    assert call_props["type"] == "RCVR"


@pytest.mark.asyncio
async def test_start_channel_calls_rest_endpoint():
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()

    mock_http = AsyncMock()
    mock_http.post = AsyncMock(return_value=mock_response)

    mock_client = MagicMock()
    mock_client._get_client.return_value = mock_http
    mock_client.auth = ("admin", "pass")

    mock_qm = MagicMock(
        internal_name="QMSRCA",
        svc_url="https://qm-src-a-svc:9443",
        client=mock_client,
    )
    mock_registry = MagicMock()
    mock_registry.get = MagicMock(return_value=mock_qm)

    with patch("bcl.agents.tools.mq_tools.get_registry", return_value=mock_registry):
        from bcl.agents.tools.mq_tools import start_channel
        result = await start_channel("QM.SRC.A", "CHL.SRCA.APP1")

    assert result["status"] == "started"
    assert result["channel"] == "CHL.SRCA.APP1"
    mock_http.post.assert_called_once()
    url = mock_http.post.call_args[0][0]
    assert "CHL.SRCA.APP1/start" in url


@pytest.mark.asyncio
async def test_move_consumer_updates_redis():
    mock_redis = AsyncMock()
    mock_redis.hset = AsyncMock()

    mock_store = MagicMock()
    mock_store._get_redis = AsyncMock(return_value=mock_redis)

    with patch("bcl.state.redis_store.RedisStore", return_value=mock_store):
        from bcl.agents.tools.mq_tools import move_consumer
        result = await move_consumer("APP1", "QM.SRC.A", "QM.APP1")

    assert result["status"] == "consumer_moved"
    assert result["app_id"] == "APP1"
    assert result["to_qm"] == "QM.APP1"
    mock_redis.hset.assert_called_once()
    call_kwargs = mock_redis.hset.call_args
    assert call_kwargs[0][0] == "consumer:APP1"
    assert call_kwargs[1]["mapping"]["qm"] == "QM.APP1"


@pytest.mark.asyncio
async def test_delete_local_queue_calls_client():
    mock_client = MagicMock()
    mock_client.delete_queue = AsyncMock()
    mock_qm = MagicMock(internal_name="QMSRCA", client=mock_client)
    mock_registry = MagicMock()
    mock_registry.get = MagicMock(return_value=mock_qm)

    with patch("bcl.agents.tools.mq_tools.get_registry", return_value=mock_registry):
        from bcl.agents.tools.mq_tools import delete_local_queue
        result = await delete_local_queue("QM.SRC.A", "Q.APP1.REQUEST.LOCAL")

    assert result["status"] == "deleted"
    assert result["queue"] == "Q.APP1.REQUEST.LOCAL"
    mock_client.delete_queue.assert_called_once_with("QMSRCA", "Q.APP1.REQUEST.LOCAL")


@pytest.mark.asyncio
async def test_delete_xmit_queue_delegates_to_delete_local_queue():
    mock_client = MagicMock()
    mock_client.delete_queue = AsyncMock()
    mock_qm = MagicMock(internal_name="QMSRCA", client=mock_client)
    mock_registry = MagicMock()
    mock_registry.get = MagicMock(return_value=mock_qm)

    with patch("bcl.agents.tools.mq_tools.get_registry", return_value=mock_registry):
        from bcl.agents.tools.mq_tools import delete_xmit_queue
        result = await delete_xmit_queue("QM.SRC.A", "Q.SRCA.APP1.XMIT.XMIT")

    assert result["status"] == "deleted"
    assert result["queue"] == "Q.SRCA.APP1.XMIT.XMIT"


@pytest.mark.asyncio
async def test_delete_remote_def_delegates_to_delete_local_queue():
    mock_client = MagicMock()
    mock_client.delete_queue = AsyncMock()
    mock_qm = MagicMock(internal_name="QMSRCA", client=mock_client)
    mock_registry = MagicMock()
    mock_registry.get = MagicMock(return_value=mock_qm)

    with patch("bcl.agents.tools.mq_tools.get_registry", return_value=mock_registry):
        from bcl.agents.tools.mq_tools import delete_remote_def
        result = await delete_remote_def("QM.SRC.A", "Q.APP1.REQUEST.LOCAL")

    assert result["status"] == "deleted"
    assert result["queue"] == "Q.APP1.REQUEST.LOCAL"
