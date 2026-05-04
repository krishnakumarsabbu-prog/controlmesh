import structlog
from fastapi import APIRouter, Request

from bcl.models.migration import AgentValidateRequest, ValidationRequest
from bcl.policy.naming import validate_naming
from bcl.policy.tls import check_tls_required
from bcl.policy.mca import check_mca_authz
from bcl.policy.dlq import check_dlq_configured

log = structlog.get_logger()
router = APIRouter(tags=["validation"])


@router.post("/validate")
async def validate_operations(payload: ValidationRequest, request: Request):
    trace_id = getattr(request.state, "trace_id", "unknown")
    results = []

    for op in payload.operations:
        violations = []
        op_type = op.get("type", "")

        violations.extend(validate_naming(op))

        if op_type in ("create_channel", "update_channel"):
            violations.extend(check_tls_required(op))
            violations.extend(check_mca_authz(op))

        if op_type == "create_queue" and payload.qm_name:
            dlq_ok = await check_dlq_configured(payload.qm_name)
            if not dlq_ok:
                violations.append({
                    "rule": "DLQ_REQUIRED",
                    "detail": f"QM {payload.qm_name} has no Dead Letter Queue configured",
                })

        results.append({
            "operation": op,
            "valid": len(violations) == 0,
            "violations": violations,
        })

    all_valid = all(r["valid"] for r in results)
    log.info(
        "validation_run",
        app_id=payload.app_id,
        qm=payload.qm_name,
        total=len(results),
        valid=sum(1 for r in results if r["valid"]),
        trace_id=trace_id,
    )
    return {
        "trace_id": trace_id,
        "all_valid": all_valid,
        "results": results,
        "summary": {
            "total": len(results),
            "valid": sum(1 for r in results if r["valid"]),
            "invalid": sum(1 for r in results if not r["valid"]),
        },
    }


@router.post("/validate/flow")
async def run_flow_validation(req: AgentValidateRequest):
    """Run agent-driven message-flow validation for a given phase."""
    import json
    from bcl.agents.base import APP_ID, get_session_service
    from bcl.agents.validation_agent import build_validation_agent
    from google.adk.runners import Runner
    from google.genai import types as genai_types

    agent = build_validation_agent()
    session_service = get_session_service()
    runner = Runner(agent=agent, app_name=APP_ID, session_service=session_service)

    session = await session_service.create_session(app_name=APP_ID, user_id=req.app_id)

    prompt = (
        f"Run {req.phase} validation for {req.app_id}. "
        f"Test queue {req.queue_name} on {req.qm_name}. "
        f"Return JSON validation result."
    )

    result_text = ""
    async for event in runner.run_async(
        session_id=session.id,
        user_id=req.app_id,
        new_message=genai_types.Content(
            role="user",
            parts=[genai_types.Part(text=prompt)],
        ),
    ):
        if event.is_final_response():
            result_text = event.content.parts[0].text

    try:
        cleaned = result_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```", 2)[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
            cleaned = cleaned.rsplit("```", 1)[0].strip()
        return json.loads(cleaned)
    except Exception:
        return {"raw": result_text, "parse_error": "response was not valid JSON"}


@router.get("/validate/{app_id}/history")
async def get_validation_history(app_id: str):
    """Return the last 100 validation results for an application."""
    import json
    from bcl.state.redis_store import RedisStore

    store = RedisStore()
    r = await store._get_redis()
    raw = await r.lrange(f"validation:{app_id}", 0, -1)
    return {
        "app_id": app_id,
        "results": [json.loads(item) for item in raw],
    }
