"""
Unit tests for orchestrator agent construction, session wiring, and migration flow.
These tests do NOT call the Gemini API — they mock the Runner and verify the
orchestrator graph, state machine transitions, and JSON parsing work correctly.
"""
import sys
import json
import types
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


def _install_aioredis_stub():
    """Inject a minimal aioredis stub into sys.modules to avoid distutils issue on Py 3.13."""
    if "aioredis" not in sys.modules:
        stub = types.ModuleType("aioredis")
        stub.Redis = MagicMock
        stub.from_url = AsyncMock(return_value=MagicMock())
        stub.StrictRedis = MagicMock
        sys.modules["aioredis"] = stub


_install_aioredis_stub()


# ── Construction and wiring ──────────────────────────────────────────────────

def test_orchestrator_builds_without_error():
    """Orchestrator and all sub-agents should instantiate without raising."""
    with patch("google.adk.agents.Agent") as MockAgent, \
         patch("google.adk.tools.agent_tool.AgentTool") as MockAgentTool:
        MockAgent.return_value = MagicMock()
        MockAgentTool.return_value = MagicMock()

        # Patch the inner builders so they don't recurse into their own deps
        with patch("bcl.agents.orchestrator.build_orchestrator.__wrapped__", create=True):
            pass

        import bcl.agents.orchestrator as orch
        with patch.object(orch, "_INSTRUCTION", orch._INSTRUCTION), \
             patch("bcl.agents.provisioning.build_provisioning_agent", return_value=MagicMock()), \
             patch("bcl.agents.migration_agent.build_migration_agent", return_value=MagicMock()), \
             patch("bcl.agents.validation_agent.build_validation_agent", return_value=MagicMock()), \
             patch("bcl.agents.rollback_agent.build_rollback_agent", return_value=MagicMock()):
            agent = orch.build_orchestrator()
        assert agent is not None


def test_session_service_is_singleton():
    """get_session_service must return the same object on repeated calls."""
    from bcl.agents.base import get_session_service
    svc1 = get_session_service()
    svc2 = get_session_service()
    assert svc1 is svc2


def test_specialist_agents_build():
    """Each specialist agent should instantiate without raising."""
    with patch("google.adk.agents.Agent") as MockAgent:
        MockAgent.return_value = MagicMock()
        from bcl.agents.provisioning import build_provisioning_agent
        from bcl.agents.migration_agent import build_migration_agent
        from bcl.agents.validation_agent import build_validation_agent
        from bcl.agents.rollback_agent import build_rollback_agent

        for builder in (
            build_provisioning_agent,
            build_migration_agent,
            build_validation_agent,
            build_rollback_agent,
        ):
            agent = builder()
            assert agent is not None


# ── JSON parsing helpers ─────────────────────────────────────────────────────

def test_parse_orchestrator_result_plain_json():
    """JSON without markdown fences should parse cleanly."""
    from bcl.agents.orchestrator import _parse_orchestrator_result
    payload = {"status": "MIGRATED", "steps_completed": ["BASELINE_VALIDATION"]}
    assert _parse_orchestrator_result(json.dumps(payload)) == payload


def test_parse_orchestrator_result_strips_markdown():
    """JSON wrapped in ```json ... ``` fences should be unwrapped before parsing."""
    from bcl.agents.orchestrator import _parse_orchestrator_result
    payload = {"status": "ROLLED_BACK", "error": "timeout"}
    fenced = f"```json\n{json.dumps(payload)}\n```"
    assert _parse_orchestrator_result(fenced) == payload


def test_build_migration_prompt_contains_required_fields():
    """Prompt must mention app_id, source_qm, target_qm, snapshot_key, and 6-step."""
    from bcl.agents.orchestrator import _build_migration_prompt
    prompt = _build_migration_prompt("APP1", "QM.SRC.A", "QM.APP1", "snap:APP1:123")
    assert "APP1" in prompt
    assert "QM.SRC.A" in prompt
    assert "QM.APP1" in prompt
    assert "snap:APP1:123" in prompt
    assert "6-step" in prompt


# ── run_migration_step integration (mocked runner) ───────────────────────────

def _make_final_event(text: str) -> MagicMock:
    event = MagicMock()
    event.is_final_response.return_value = True
    event.content.parts = [MagicMock(text=text)]
    event.get_function_calls.return_value = []
    return event


def _make_tool_event(tool_name: str) -> MagicMock:
    event = MagicMock()
    event.is_final_response.return_value = False
    call = MagicMock()
    call.name = tool_name
    event.get_function_calls.return_value = [call]
    return event


def _session_service_mock():
    mock_session = MagicMock()
    mock_session.id = "test-session-id"
    svc = AsyncMock()
    svc.create_session = AsyncMock(return_value=mock_session)
    return svc


@pytest.mark.asyncio
async def test_successful_migration_returns_migrated():
    """run_migration_step returns MIGRATED when orchestrator reports success."""
    mock_result = {
        "status": "MIGRATED",
        "app_id": "APP1",
        "source_qm": "QM.SRC.A",
        "target_qm": "QM.APP1",
        "steps_completed": [
            "BASELINE_VALIDATION", "PROVISION_TARGET",
            "REWIRING", "POST_REWIRE_VALIDATION",
            "CUTOVER", "FINAL_VALIDATION",
        ],
        "validation_results": [
            {"phase": "BASELINE", "passed": True, "latency_ms": 42},
            {"phase": "POST_REWIRE", "passed": True, "latency_ms": 38},
            {"phase": "FINAL", "passed": True, "latency_ms": 35},
        ],
        "error": None,
    }

    async def mock_run_async(**kwargs):
        yield _make_final_event(json.dumps(mock_result))

    mock_runner = MagicMock()
    mock_runner.run_async = mock_run_async
    mock_sm = AsyncMock()
    mock_sm.transition = AsyncMock()

    import bcl.agents.orchestrator as orch

    with patch.object(orch, "build_orchestrator", return_value=MagicMock()), \
         patch.object(orch, "get_session_service", return_value=_session_service_mock()), \
         patch.object(orch, "Runner", return_value=mock_runner), \
         patch.object(orch, "ORCHESTRATOR_RUNS") as m_runs, \
         patch.object(orch, "ORCHESTRATOR_DURATION") as m_dur, \
         patch.object(orch, "AGENT_TOOL_CALLS") as m_calls, \
         patch("bcl.state.state_machine.MigrationStateMachine", return_value=mock_sm), \
         patch("bcl.state.redis_store.RedisStore"):

        m_runs.labels.return_value = MagicMock()
        m_dur.observe = MagicMock()
        m_calls.labels.return_value = MagicMock()

        result = await orch.run_migration_step(
            "APP1", "QM.SRC.A", "QM.APP1", "snapshot:APP1:pre:123"
        )

    assert result["status"] == "MIGRATED"
    assert len(result["steps_completed"]) == 6
    assert result["error"] is None


@pytest.mark.asyncio
async def test_validation_failure_triggers_rolled_back_state():
    """When orchestrator returns ROLLED_BACK, state machine transitions to ROLLED_BACK."""
    mock_result = {
        "status": "ROLLED_BACK",
        "app_id": "APP1",
        "source_qm": "QM.SRC.A",
        "target_qm": "QM.APP1",
        "steps_completed": [
            "BASELINE_VALIDATION", "PROVISION_TARGET", "REWIRING",
        ],
        "validation_results": [
            {"phase": "BASELINE", "passed": True, "latency_ms": 42},
            {"phase": "POST_REWIRE", "passed": False, "latency_ms": 5001},
        ],
        "error": "POST_REWIRE validation failed: message not delivered within 5s",
    }

    async def mock_run_async(**kwargs):
        yield _make_final_event(json.dumps(mock_result))

    mock_runner = MagicMock()
    mock_runner.run_async = mock_run_async
    mock_sm = AsyncMock()
    mock_sm.transition = AsyncMock()

    import bcl.agents.orchestrator as orch

    with patch.object(orch, "build_orchestrator", return_value=MagicMock()), \
         patch.object(orch, "get_session_service", return_value=_session_service_mock()), \
         patch.object(orch, "Runner", return_value=mock_runner), \
         patch.object(orch, "ORCHESTRATOR_RUNS") as m_runs, \
         patch.object(orch, "ORCHESTRATOR_DURATION") as m_dur, \
         patch.object(orch, "AGENT_TOOL_CALLS") as m_calls, \
         patch("bcl.state.state_machine.MigrationStateMachine", return_value=mock_sm), \
         patch("bcl.state.redis_store.RedisStore"):

        m_runs.labels.return_value = MagicMock()
        m_dur.observe = MagicMock()
        m_calls.labels.return_value = MagicMock()

        result = await orch.run_migration_step(
            "APP1", "QM.SRC.A", "QM.APP1", "snapshot:APP1:pre:123"
        )

    assert result["status"] == "ROLLED_BACK"
    assert "POST_REWIRE" in result["error"]

    from bcl.models.migration import MigrationState
    transition_states = [call.args[1] for call in mock_sm.transition.call_args_list]
    assert MigrationState.ROLLED_BACK in transition_states


@pytest.mark.asyncio
async def test_tool_calls_increment_agent_tool_calls_metric():
    """Intermediate tool-call events should increment AGENT_TOOL_CALLS metric."""
    final_result = {
        "status": "MIGRATED",
        "app_id": "APP1",
        "source_qm": "QM.SRC.A",
        "target_qm": "QM.APP1",
        "steps_completed": ["BASELINE_VALIDATION", "PROVISION_TARGET"],
        "validation_results": [],
        "error": None,
    }

    async def mock_run_async(**kwargs):
        yield _make_tool_event("provisioning_agent")
        yield _make_final_event(json.dumps(final_result))

    mock_runner = MagicMock()
    mock_runner.run_async = mock_run_async
    mock_sm = AsyncMock()
    mock_sm.transition = AsyncMock()

    import bcl.agents.orchestrator as orch

    with patch.object(orch, "build_orchestrator", return_value=MagicMock()), \
         patch.object(orch, "get_session_service", return_value=_session_service_mock()), \
         patch.object(orch, "Runner", return_value=mock_runner), \
         patch.object(orch, "ORCHESTRATOR_RUNS") as m_runs, \
         patch.object(orch, "ORCHESTRATOR_DURATION") as m_dur, \
         patch.object(orch, "AGENT_TOOL_CALLS") as m_calls, \
         patch("bcl.state.state_machine.MigrationStateMachine", return_value=mock_sm), \
         patch("bcl.state.redis_store.RedisStore"):

        m_runs.labels.return_value = MagicMock()
        m_dur.observe = MagicMock()
        mock_labels_counter = MagicMock()
        m_calls.labels.return_value = mock_labels_counter

        await orch.run_migration_step(
            "APP1", "QM.SRC.A", "QM.APP1", "snapshot:APP1:pre:123"
        )

    m_calls.labels.assert_called_with(
        agent="orchestrator", tool="provisioning_agent", result="called"
    )
    mock_labels_counter.inc.assert_called_once()
