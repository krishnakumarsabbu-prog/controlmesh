import json
import structlog
from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.tools import agent_tool

from .base import GEMINI_MODEL, APP_ID, get_session_service

log = structlog.get_logger()

_INSTRUCTION = """
You are the Migration Orchestrator for an IBM MQ topology migration system.

Your job is to plan and execute the migration of a single application from a
shared source queue manager to its own dedicated target queue manager.

You coordinate four specialist agents:
- provisioning_agent: creates QM objects (queues, channels, DLQ)
- migration_agent: handles topology diffing and transparent rewiring
- validation_agent: tests message flows before, during, and after migration
- rollback_agent: restores pre-migration state from Redis snapshots

Standard migration sequence (always follow this order):
1. Baseline validation via validation_agent — confirm source QM is healthy
2. Provision target QM via provisioning_agent — DLQ must be created first
3. Post-provision validation via validation_agent — confirm target QM is reachable
4. Rewire flows via migration_agent — create remote defs and channels
5. Post-rewire validation via validation_agent — confirm messages flow through
6. Final cutover confirmation and cleanup

Rules:
- Always validate BEFORE any rewiring starts (baseline)
- After rewiring, validate again (transparent flow test)
- If any validation fails, immediately invoke rollback_agent
- Never skip DLQ creation — provisioning_agent must set_dlq before other queues
- Naming conventions are enforced by BCL policy — use correct patterns
- Emit audit log entries at each major step

Return ONLY a valid JSON object (no markdown, no commentary):
{
  "status": "MIGRATED" | "ROLLED_BACK" | "FAILED",
  "steps_completed": ["baseline_validation", "provisioning", ...],
  "validation_results": [{"phase": "...", "passed": true|false}],
  "error": null | "description"
}
"""


def build_orchestrator() -> Agent:
    from .provisioning import build_provisioning_agent
    from .migration_agent import build_migration_agent
    from .validation_agent import build_validation_agent
    from .rollback_agent import build_rollback_agent

    return Agent(
        name="orchestrator",
        model=GEMINI_MODEL,
        instruction=_INSTRUCTION,
        tools=[
            agent_tool.AgentTool(agent=build_provisioning_agent()),
            agent_tool.AgentTool(agent=build_migration_agent()),
            agent_tool.AgentTool(agent=build_validation_agent()),
            agent_tool.AgentTool(agent=build_rollback_agent()),
        ],
    )


async def run_migration_step(
    app_id: str, source_qm: str, target_qm: str, snapshot_key: str
) -> dict:
    from bcl.state.state_machine import MigrationStateMachine
    from bcl.state.redis_store import RedisStore
    from bcl.models.migration import MigrationState

    sm = MigrationStateMachine(RedisStore())
    orchestrator = build_orchestrator()
    session_service = get_session_service()
    runner = Runner(agent=orchestrator, app_name=APP_ID, session_service=session_service)

    session = await session_service.create_session(app_name=APP_ID, user_id=app_id)

    prompt = (
        f"Migrate application {app_id} from {source_qm} to {target_qm}. "
        f"The pre-migration snapshot is stored at key {snapshot_key}. "
        f"Follow the standard migration sequence: "
        f"1) baseline validation, 2) provision target QM with DLQ, "
        f"3) rewire flows, 4) post-rewire validation, 5) cutover, "
        f"6) final validation. Roll back automatically if any validation fails."
    )

    try:
        result_text = ""
        async for event in runner.run_async(
            session_id=session.id, user_id=app_id, new_message=prompt
        ):
            if event.is_final_response():
                result_text = event.content.parts[0].text

        result = json.loads(result_text)
        final_state = MigrationState(result.get("status", "ROLLED_BACK"))
        await sm.transition(app_id, final_state, {"steps": result.get("steps_completed", [])})
        return result

    except Exception as exc:
        log.error("orchestrator_error", app_id=app_id, error=str(exc))
        await sm.transition(app_id, MigrationState.ROLLING_BACK, {"error": str(exc)})
        raise
