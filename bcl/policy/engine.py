import structlog
from fastapi import HTTPException

from .naming import validate_naming
from .dlq import check_dlq_configured
from .tls import check_tls_required
from .mca import check_mca_authz

log = structlog.get_logger()


async def enforce_pre_operation(operation: dict, qm_name: str) -> None:
    """
    Run all policy checks synchronously before any MQ object is touched.
    Raises HTTP 422 immediately on the first set of violations found.
    """
    violations = []

    violations.extend(validate_naming(operation))

    if operation.get("type") == "create_queue":
        dlq_ok = await check_dlq_configured(qm_name)
        if not dlq_ok:
            violations.append({
                "rule": "DLQ_REQUIRED",
                "detail": f"QM {qm_name} has no Dead Letter Queue configured",
            })

    if operation.get("type") in ("create_channel", "update_channel"):
        violations.extend(check_tls_required(operation))
        violations.extend(check_mca_authz(operation))

    if violations:
        log.warning("policy_violation", violations=violations, qm=qm_name)
        raise HTTPException(status_code=422, detail={
            "error": "POLICY_VIOLATION",
            "violations": violations,
        })
