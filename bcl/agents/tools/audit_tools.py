import time

from bcl.state.redis_store import RedisStore


async def log_audit_event(
    operation: str,
    qm_target: str,
    agent: str,
    result: str,
    trace_id: str = "",
    details: dict = None,
) -> dict:
    """Append a structured audit event to the Redis audit log."""
    store = RedisStore()
    event = {
        "operation": operation,
        "qm_target": qm_target,
        "agent": agent,
        "result": result,
        "trace_id": trace_id,
        "details": details or {},
        "timestamp": time.time(),
    }
    await store.append_audit(event)
    return {"logged": True}
