import json
import structlog
from google.adk.agents import Agent
from google.adk.runners import Runner

from .base import GEMINI_MODEL, APP_ID, get_session_service
from .tools.rollback_tools import (
    load_snapshot,
    delete_remote_def_safe,
    delete_xmit_queue_safe,
    stop_channel_safe,
    delete_channel_safe,
    restore_queue,
    verify_rollback,
)
from .tools.audit_tools import log_audit_event

log = structlog.get_logger()

_INSTRUCTION = """
You are the IBM MQ Rollback Agent. Your job is to restore the pre-migration
state when a migration step fails or validation detects broken flows.

## Tools available
- load_snapshot(app_id) → pre-migration topology from Redis
- delete_remote_def_safe(qm_name, remote_def_name) → idempotent delete
- delete_xmit_queue_safe(qm_name, xmit_queue_name) → idempotent delete
- stop_channel_safe(qm_name, channel_name) → stop channel if running
- delete_channel_safe(qm_name, channel_name) → idempotent delete
- restore_queue(qm_name, queue_name, queue_props) → recreate if missing
- verify_rollback(app_id, source_qm) → run put/get to confirm source works
- log_audit_event(operation, qm_target, agent, result)

## Rollback sequence (ALWAYS in this order)
1. load_snapshot — identify exactly what was in place before migration
2. delete_remote_def_safe — remove transparent routing definition from source QM
3. stop_channel_safe — stop SDR channel on source QM
4. delete_channel_safe — remove SDR channel on source QM
5. delete_channel_safe — remove RCVR channel on target QM
6. delete_xmit_queue_safe — remove transmission queue from source QM
7. restore_queue — if original local queue was removed during cutover, recreate it
   using properties from the snapshot
8. verify_rollback — send test message through source QM to confirm original flow works
9. log_audit_event with final result

## Idempotency rule
ALL delete/stop operations must be safe to call even if the object does not exist.
Return success if already absent — never fail because an object is missing.

## Naming conventions
- Remote def name matches original local queue name: e.g., Q.APP1.REQUEST.LOCAL
- SDR channel: CHL.<SRC_SHORT>.<APP> e.g., CHL.SRCA.APP1
- RCVR channel: same name on target QM
- Xmit queue: Q.<SRC_SHORT>.<APP>.XMIT.XMIT e.g., Q.SRCA.APP1.XMIT.XMIT

## Response format
Return ONLY valid JSON (no markdown, no commentary):
{
  "status": "ROLLED_BACK" | "ROLLBACK_FAILED",
  "app_id": "<id>",
  "objects_removed": ["<list of what was deleted>"],
  "objects_restored": ["<list of what was recreated>"],
  "verified": true | false,
  "error": null | "<description>"
}
"""


def build_rollback_agent() -> Agent:
    return Agent(
        name="rollback_agent",
        model=GEMINI_MODEL,
        instruction=_INSTRUCTION,
        tools=[
            load_snapshot,
            delete_remote_def_safe,
            delete_xmit_queue_safe,
            stop_channel_safe,
            delete_channel_safe,
            restore_queue,
            verify_rollback,
            log_audit_event,
        ],
    )


async def run_rollback(app_id: str) -> dict:
    """
    Called by the Orchestrator or BCL router to execute automated rollback.
    Drives the rollback agent and updates the state machine on completion.
    """
    from bcl.state.state_machine import MigrationStateMachine
    from bcl.state.redis_store import RedisStore
    from bcl.models.migration import MigrationState

    sm = MigrationStateMachine(RedisStore())
    record = await sm.get(app_id)
    source_qm = record.source_qm or "QM.SRC.A"
    safe_id = app_id.replace("-", "").upper()
    target_qm = record.target_qm or f"QM.{safe_id}"

    agent = build_rollback_agent()
    session_service = get_session_service()
    runner = Runner(agent=agent, app_name=APP_ID, session_service=session_service)

    session = await session_service.create_session(
        app_name=APP_ID,
        user_id=f"rollback-{app_id}",
        state={"app_id": app_id, "source_qm": source_qm, "target_qm": target_qm},
    )

    prompt = (
        f"Roll back the failed migration of {app_id}. "
        f"Source QM is {source_qm}. "
        f"Target QM was {target_qm}. "
        f"Remove all rewiring artefacts (remote def, SDR channel, RCVR channel, xmit queue) "
        f"and restore the source topology. "
        f"Return JSON rollback result."
    )

    log.info("rollback_start", app_id=app_id, source_qm=source_qm, target_qm=target_qm)

    try:
        result_text = ""
        async for event in runner.run_async(
            session_id=session.id,
            user_id=f"rollback-{app_id}",
            new_message=prompt,
        ):
            if event.is_final_response():
                result_text = event.content.parts[0].text
                break

        result = _parse_rollback_result(result_text)
    except Exception as exc:
        log.error("rollback_runner_exception", app_id=app_id, error=str(exc))
        result = {
            "status": "ROLLBACK_FAILED",
            "app_id": app_id,
            "objects_removed": [],
            "objects_restored": [],
            "verified": False,
            "error": str(exc),
        }

    if result.get("status") == "ROLLED_BACK":
        await sm.transition(
            app_id,
            MigrationState.ROLLED_BACK,
            {"verified": result.get("verified", False)},
        )
        log.info("rollback_complete", app_id=app_id, verified=result.get("verified"))
    else:
        log.error("rollback_failed", app_id=app_id, result=result)

    return result


def _parse_rollback_result(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1])
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {
            "status": "ROLLBACK_FAILED",
            "error": f"Could not parse agent response: {text[:200]}",
            "objects_removed": [],
            "objects_restored": [],
            "verified": False,
        }
