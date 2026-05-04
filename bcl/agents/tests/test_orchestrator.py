"""
Unit tests for orchestrator agent construction and session service wiring.
These tests do NOT call the Gemini API — they verify the agent graph builds
correctly and that the session service is shared across calls.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


def test_orchestrator_builds_without_error():
    """Orchestrator and all sub-agents should instantiate without raising."""
    with patch("google.adk.agents.Agent") as MockAgent, \
         patch("google.adk.tools.agent_tool.AgentTool") as MockAgentTool:
        MockAgent.return_value = MagicMock()
        MockAgentTool.return_value = MagicMock()

        from bcl.agents.orchestrator import build_orchestrator
        agent = build_orchestrator()
        assert agent is not None


def test_session_service_is_singleton():
    """get_session_service must return the same object on repeated calls."""
    from bcl.agents.base import get_session_service
    svc1 = get_session_service()
    svc2 = get_session_service()
    assert svc1 is svc2


def test_make_runner_uses_shared_session():
    """make_runner must wire the agent to the shared InMemorySessionService."""
    with patch("google.adk.agents.Agent") as MockAgent, \
         patch("google.adk.runners.Runner") as MockRunner:
        MockAgent.return_value = MagicMock()
        MockRunner.return_value = MagicMock()

        from bcl.agents.base import make_runner, get_session_service
        mock_agent = MockAgent()
        make_runner(mock_agent)

        call_kwargs = MockRunner.call_args.kwargs
        assert call_kwargs["session_service"] is get_session_service()
        assert call_kwargs["app_name"] == "mq-migration"


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
