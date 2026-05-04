import structlog
from fastapi import APIRouter, Request

from bcl.models.migration import ValidationRequest
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
