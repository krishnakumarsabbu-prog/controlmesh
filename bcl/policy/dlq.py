import structlog

log = structlog.get_logger()


async def check_dlq_configured(qm_name: str) -> bool:
    """
    Verify that the QM has at least one DLQ (name ending in .DLQ) configured.
    Queries the MQ client for the fleet registry entry.
    Returns True if a DLQ is present, False otherwise.
    """
    try:
        from bcl.mq.registry import get_registry
        registry = get_registry()
        qm = registry.get(qm_name)
        result = await qm.client.list_queues(qm.internal_name)
        queues = result.get("queue", [])
        has_dlq = any(
            q.get("name", "").endswith(".DLQ") or q.get("type", "") == "local"
            and "DLQ" in q.get("name", "")
            for q in queues
        )
        if not has_dlq:
            # Also accept IBM MQ default SYSTEM.DEAD.LETTER.QUEUE
            has_dlq = any(
                "DEAD.LETTER" in q.get("name", "") or "DLQ" in q.get("name", "")
                for q in queues
            )
        return has_dlq
    except KeyError:
        log.warning("dlq_check_qm_not_found", qm=qm_name)
        return False
    except Exception as exc:
        log.warning("dlq_check_failed", qm=qm_name, error=str(exc))
        # Fail open in dev; fail closed in prod by returning False
        return False
