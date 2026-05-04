"""
Unit tests for Phase 9: Rollback Agent and rollback tools.
No Gemini API calls — all external dependencies are mocked.
"""
import sys
import json
import types
import pytest
from unittest.mock import AsyncMock, MagicMock, patch, call


def _install_aioredis_stub():
    if "aioredis" not in sys.modules:
        stub = types.ModuleType("aioredis")
        stub.Redis = MagicMock
        stub.from_url = AsyncMock(return_value=MagicMock())
        stub.StrictRedis = MagicMock
        sys.modules["aioredis"] = stub


_install_aioredis_stub()


# ── build_rollback_agent construction ────────────────────────────────────────

def test_rollback_agent_builds():
    with patch("google.adk.agents.Agent") as MockAgent:
        MockAgent.return_value = MagicMock()
        from bcl.agents.rollback_agent import build_rollback_agent
        agent = build_rollback_agent()
        assert agent is not None


def test_rollback_agent_has_all_tools():
    """Rollback agent must be wired with the 8 Phase 9 tools."""
    tools_seen = []

    class _MockAgent:
        def __init__(self, **kwargs):
            tools_seen.extend([t.__name__ for t in kwargs.get("tools", []) if callable(t)])

    with patch("google.adk.agents.Agent", _MockAgent):
        from bcl.agents import rollback_agent as _rb_mod
        import importlib
        importlib.reload(_rb_mod)
        _rb_mod.build_rollback_agent()

    required = {
        "load_snapshot",
        "delete_remote_def_safe",
        "delete_xmit_queue_safe",
        "stop_channel_safe",
        "delete_channel_safe",
        "restore_queue",
        "verify_rollback",
        "log_audit_event",
    }
    assert required.issubset(set(tools_seen)), f"Missing tools: {required - set(tools_seen)}"


# ── _parse_rollback_result ────────────────────────────────────────────────────

def test_parse_plain_json():
    from bcl.agents.rollback_agent import _parse_rollback_result
    payload = {"status": "ROLLED_BACK", "verified": True, "objects_removed": []}
    assert _parse_rollback_result(json.dumps(payload)) == payload


def test_parse_strips_markdown_fences():
    from bcl.agents.rollback_agent import _parse_rollback_result
    payload = {"status": "ROLLED_BACK", "verified": False, "error": "timeout"}
    fenced = f"```json\n{json.dumps(payload)}\n```"
    assert _parse_rollback_result(fenced) == payload


def test_parse_bad_json_returns_failed():
    from bcl.agents.rollback_agent import _parse_rollback_result
    result = _parse_rollback_result("not json at all")
    assert result["status"] == "ROLLBACK_FAILED"
    assert result["verified"] is False


# ── rollback_tools unit tests ─────────────────────────────────────────────────

def _make_registry(mock_qm):
    mock_registry = MagicMock()
    mock_registry.get.return_value = mock_qm
    return mock_registry


@pytest.mark.asyncio
async def test_load_snapshot_found():
    from bcl.agents.tools.rollback_tools import load_snapshot
    mock_store = AsyncMock()
    mock_store.load_latest_snapshot = AsyncMock(return_value={"queues": ["Q.APP1.REQUEST.LOCAL"]})
    with patch("bcl.state.redis_store.RedisStore", return_value=mock_store):
        result = await load_snapshot("APP1")
    assert result["snapshot"]["queues"] == ["Q.APP1.REQUEST.LOCAL"]
    assert result["app_id"] == "APP1"


@pytest.mark.asyncio
async def test_load_snapshot_not_found():
    from bcl.agents.tools.rollback_tools import load_snapshot
    mock_store = AsyncMock()
    mock_store.load_latest_snapshot = AsyncMock(return_value=None)
    with patch("bcl.state.redis_store.RedisStore", return_value=mock_store):
        result = await load_snapshot("APP1")
    assert "error" in result
    assert result["snapshot"] is None


@pytest.mark.asyncio
async def test_delete_remote_def_safe_deleted():
    from bcl.agents.tools.rollback_tools import delete_remote_def_safe
    mock_qm = MagicMock()
    mock_qm.client.delete_queue = AsyncMock()
    mock_qm.internal_name = "QMSRCA"
    with patch("bcl.mq.registry.get_registry", return_value=_make_registry(mock_qm)):
        result = await delete_remote_def_safe("QM.SRC.A", "Q.APP1.REQUEST.LOCAL")
    assert result["status"] == "deleted"
    assert result["object"] == "Q.APP1.REQUEST.LOCAL"


@pytest.mark.asyncio
async def test_delete_remote_def_safe_already_absent():
    from bcl.agents.tools.rollback_tools import delete_remote_def_safe
    mock_qm = MagicMock()
    mock_qm.client.delete_queue = AsyncMock(side_effect=Exception("404 not found"))
    mock_qm.internal_name = "QMSRCA"
    with patch("bcl.mq.registry.get_registry", return_value=_make_registry(mock_qm)):
        result = await delete_remote_def_safe("QM.SRC.A", "Q.APP1.REQUEST.LOCAL")
    assert result["status"] == "already_absent"


@pytest.mark.asyncio
async def test_delete_xmit_queue_safe_idempotent():
    from bcl.agents.tools.rollback_tools import delete_xmit_queue_safe
    mock_qm = MagicMock()
    mock_qm.client.delete_queue = AsyncMock(side_effect=Exception("MQRC_UNKNOWN_OBJECT_NAME"))
    mock_qm.internal_name = "QMSRCA"
    with patch("bcl.mq.registry.get_registry", return_value=_make_registry(mock_qm)):
        result = await delete_xmit_queue_safe("QM.SRC.A", "Q.SRCA.APP1.XMIT.XMIT")
    assert result["status"] == "already_absent"


@pytest.mark.asyncio
async def test_stop_channel_safe_success():
    from bcl.agents.tools.rollback_tools import stop_channel_safe
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_http = AsyncMock()
    mock_http.post = AsyncMock(return_value=mock_response)
    mock_qm = MagicMock()
    mock_qm.client._get_client.return_value = mock_http
    mock_qm.client.auth = ("admin", "passw0rd")
    mock_qm.svc_url = "https://qm-svc:9443"
    mock_qm.internal_name = "QMSRCA"
    with patch("bcl.mq.registry.get_registry", return_value=_make_registry(mock_qm)):
        result = await stop_channel_safe("QM.SRC.A", "CHL.SRCA.APP1")
    assert result["status"] == "stopped"


@pytest.mark.asyncio
async def test_stop_channel_safe_exception_is_safe():
    from bcl.agents.tools.rollback_tools import stop_channel_safe
    mock_http = AsyncMock()
    mock_http.post = AsyncMock(side_effect=Exception("connection refused"))
    mock_qm = MagicMock()
    mock_qm.client._get_client.return_value = mock_http
    mock_qm.client.auth = ("admin", "passw0rd")
    mock_qm.svc_url = "https://qm-svc:9443"
    mock_qm.internal_name = "QMSRCA"
    with patch("bcl.mq.registry.get_registry", return_value=_make_registry(mock_qm)):
        result = await stop_channel_safe("QM.SRC.A", "CHL.SRCA.APP1")
    assert result["status"] == "already_absent_or_stopped"


@pytest.mark.asyncio
async def test_delete_channel_safe_deleted():
    from bcl.agents.tools.rollback_tools import delete_channel_safe
    mock_response = MagicMock()
    mock_response.status_code = 204
    mock_http = AsyncMock()
    mock_http.delete = AsyncMock(return_value=mock_response)
    mock_qm = MagicMock()
    mock_qm.client._get_client.return_value = mock_http
    mock_qm.client.auth = ("admin", "passw0rd")
    mock_qm.svc_url = "https://qm-svc:9443"
    mock_qm.internal_name = "QMSRCA"
    with patch("bcl.mq.registry.get_registry", return_value=_make_registry(mock_qm)):
        result = await delete_channel_safe("QM.SRC.A", "CHL.SRCA.APP1")
    assert result["status"] == "deleted"


@pytest.mark.asyncio
async def test_restore_queue_already_present():
    from bcl.agents.tools.rollback_tools import restore_queue
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_http = AsyncMock()
    mock_http.get = AsyncMock(return_value=mock_response)
    mock_qm = MagicMock()
    mock_qm.client._get_client.return_value = mock_http
    mock_qm.client.auth = ("admin", "passw0rd")
    mock_qm.svc_url = "https://qm-svc:9443"
    mock_qm.internal_name = "QMSRCA"
    with patch("bcl.mq.registry.get_registry", return_value=_make_registry(mock_qm)), \
         patch("bcl.policy.engine.enforce_pre_operation", new_callable=AsyncMock):
        result = await restore_queue("QM.SRC.A", "Q.APP1.REQUEST.LOCAL")
    assert result["status"] == "already_present"


@pytest.mark.asyncio
async def test_restore_queue_creates_when_absent():
    from bcl.agents.tools.rollback_tools import restore_queue
    mock_response_404 = MagicMock()
    mock_response_404.status_code = 404
    mock_http = AsyncMock()
    mock_http.get = AsyncMock(return_value=mock_response_404)
    mock_qm = MagicMock()
    mock_qm.client._get_client.return_value = mock_http
    mock_qm.client.auth = ("admin", "passw0rd")
    mock_qm.client.create_queue = AsyncMock()
    mock_qm.svc_url = "https://qm-svc:9443"
    mock_qm.internal_name = "QMSRCA"
    with patch("bcl.mq.registry.get_registry", return_value=_make_registry(mock_qm)), \
         patch("bcl.policy.engine.enforce_pre_operation", new_callable=AsyncMock):
        result = await restore_queue(
            "QM.SRC.A", "Q.APP1.REQUEST.LOCAL", {"description": "Original queue"}
        )
    assert result["status"] == "restored"
    mock_qm.client.create_queue.assert_awaited_once()


@pytest.mark.asyncio
async def test_verify_rollback_passes():
    from bcl.agents.tools.rollback_tools import verify_rollback
    with patch("bcl.agents.tools.validation_tools.put_test_message",
               new_callable=AsyncMock,
               return_value={"status": "put", "correlation_id": "abc123", "sent_at": 1.0}), \
         patch("bcl.agents.tools.validation_tools.get_test_message",
               new_callable=AsyncMock,
               return_value={"status": "received", "body": "VALIDATION_TEST|abc123|ROLLBACK_VERIFY_APP1|1.0", "latency_ms": 42.0}), \
         patch("bcl.agents.tools.validation_tools.assert_delivery",
               new_callable=AsyncMock,
               return_value={"passed": True, "latency_ms": 42.0, "reason": "DELIVERED"}):
        result = await verify_rollback("APP1", "QM.SRC.A")
    assert result["verified"] is True
    assert result["latency_ms"] == 42.0
    assert result["app_id"] == "APP1"


@pytest.mark.asyncio
async def test_verify_rollback_put_error():
    from bcl.agents.tools.rollback_tools import verify_rollback
    with patch("bcl.agents.tools.validation_tools.put_test_message",
               new_callable=AsyncMock,
               return_value={"error": "QM not found"}):
        result = await verify_rollback("APP1", "QM.SRC.A")
    assert result["verified"] is False
    assert "error" in result


# ── run_rollback integration (mocked runner) ──────────────────────────────────

def _make_final_event(text: str) -> MagicMock:
    event = MagicMock()
    event.is_final_response.return_value = True
    event.content.parts = [MagicMock(text=text)]
    return event


def _session_service_mock():
    mock_session = MagicMock()
    mock_session.id = "rb-session-id"
    svc = AsyncMock()
    svc.create_session = AsyncMock(return_value=mock_session)
    return svc


@pytest.mark.asyncio
async def test_run_rollback_successful():
    mock_result = {
        "status": "ROLLED_BACK",
        "app_id": "APP1",
        "objects_removed": [
            "Q.APP1.REQUEST.LOCAL (REMOTE)",
            "CHL.SRCA.APP1 (SDR)",
            "CHL.SRCA.APP1 (RCVR)",
            "Q.SRCA.APP1.XMIT.XMIT",
        ],
        "objects_restored": ["Q.APP1.REQUEST.LOCAL (LOCAL)"],
        "verified": True,
        "error": None,
    }

    async def mock_run_async(**kwargs):
        yield _make_final_event(json.dumps(mock_result))

    mock_runner = MagicMock()
    mock_runner.run_async = mock_run_async
    mock_sm = AsyncMock()
    mock_sm.get = AsyncMock(return_value=MagicMock(
        source_qm="QM.SRC.A", target_qm="QM.APP1"
    ))
    mock_sm.transition = AsyncMock()

    import bcl.agents.rollback_agent as rb

    with patch.object(rb, "build_rollback_agent", return_value=MagicMock()), \
         patch.object(rb, "get_session_service", return_value=_session_service_mock()), \
         patch.object(rb, "Runner", return_value=mock_runner), \
         patch("bcl.state.state_machine.MigrationStateMachine", return_value=mock_sm), \
         patch("bcl.state.redis_store.RedisStore"):

        result = await rb.run_rollback("APP1")

    assert result["status"] == "ROLLED_BACK"
    assert result["verified"] is True
    assert len(result["objects_removed"]) == 4

    from bcl.models.migration import MigrationState
    transition_states = [c.args[1] for c in mock_sm.transition.call_args_list]
    assert MigrationState.ROLLED_BACK in transition_states


@pytest.mark.asyncio
async def test_run_rollback_agent_failure():
    mock_result = {
        "status": "ROLLBACK_FAILED",
        "app_id": "APP1",
        "objects_removed": [],
        "objects_restored": [],
        "verified": False,
        "error": "Could not reach source QM",
    }

    async def mock_run_async(**kwargs):
        yield _make_final_event(json.dumps(mock_result))

    mock_runner = MagicMock()
    mock_runner.run_async = mock_run_async
    mock_sm = AsyncMock()
    mock_sm.get = AsyncMock(return_value=MagicMock(
        source_qm="QM.SRC.A", target_qm="QM.APP1"
    ))
    mock_sm.transition = AsyncMock()

    import bcl.agents.rollback_agent as rb

    with patch.object(rb, "build_rollback_agent", return_value=MagicMock()), \
         patch.object(rb, "get_session_service", return_value=_session_service_mock()), \
         patch.object(rb, "Runner", return_value=mock_runner), \
         patch("bcl.state.state_machine.MigrationStateMachine", return_value=mock_sm), \
         patch("bcl.state.redis_store.RedisStore"):

        result = await rb.run_rollback("APP1")

    assert result["status"] == "ROLLBACK_FAILED"
    assert result["verified"] is False
    # Should NOT transition to ROLLED_BACK on failure
    from bcl.models.migration import MigrationState
    transition_states = [c.args[1] for c in mock_sm.transition.call_args_list]
    assert MigrationState.ROLLED_BACK not in transition_states


@pytest.mark.asyncio
async def test_run_rollback_runner_exception_returns_failed():
    async def mock_run_async(**kwargs):
        raise RuntimeError("Gemini unavailable")
        yield  # make it an async generator

    mock_runner = MagicMock()
    mock_runner.run_async = mock_run_async
    mock_sm = AsyncMock()
    mock_sm.get = AsyncMock(return_value=MagicMock(
        source_qm="QM.SRC.A", target_qm="QM.APP1"
    ))
    mock_sm.transition = AsyncMock()

    import bcl.agents.rollback_agent as rb

    with patch.object(rb, "build_rollback_agent", return_value=MagicMock()), \
         patch.object(rb, "get_session_service", return_value=_session_service_mock()), \
         patch.object(rb, "Runner", return_value=mock_runner), \
         patch("bcl.state.state_machine.MigrationStateMachine", return_value=mock_sm), \
         patch("bcl.state.redis_store.RedisStore"):

        result = await rb.run_rollback("APP1")

    assert result["status"] == "ROLLBACK_FAILED"
    assert "Gemini unavailable" in result["error"]


# ── Idempotency: double-rollback safe ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_rollback_tools_idempotent_on_second_call():
    """Calling delete tools twice should not raise — second call returns already_absent."""
    from bcl.agents.tools.rollback_tools import delete_remote_def_safe

    call_count = 0

    async def side_effect(internal_name, queue_name):
        nonlocal call_count
        call_count += 1
        if call_count > 1:
            raise Exception("404 not found")

    mock_qm = MagicMock()
    mock_qm.client.delete_queue = AsyncMock(side_effect=side_effect)
    mock_qm.internal_name = "QMSRCA"

    with patch("bcl.mq.registry.get_registry", return_value=_make_registry(mock_qm)):
        result1 = await delete_remote_def_safe("QM.SRC.A", "Q.APP1.REQUEST.LOCAL")
        result2 = await delete_remote_def_safe("QM.SRC.A", "Q.APP1.REQUEST.LOCAL")

    assert result1["status"] == "deleted"
    assert result2["status"] == "already_absent"
