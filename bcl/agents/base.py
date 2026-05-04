import structlog
from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService

log = structlog.get_logger()

GEMINI_MODEL = "gemini-2.0-flash"
APP_ID = "mq-migration"

# Shared session service — maintains state across multi-turn agent calls
_session_service = InMemorySessionService()


def get_session_service() -> InMemorySessionService:
    return _session_service


def make_runner(agent: Agent) -> Runner:
    return Runner(
        agent=agent,
        app_name=APP_ID,
        session_service=_session_service,
    )
