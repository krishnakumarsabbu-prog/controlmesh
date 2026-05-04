import asyncio
import json
import time
import uuid
from typing import Optional

import structlog

log = structlog.get_logger()


async def put_test_message(
    qm_name: str,
    queue_name: str,
    message_body: str,
    correlation_id: Optional[str] = None,
) -> dict:
    """PUT a test message to a queue. Returns message ID and correlation ID."""
    from bcl.mq.registry import get_registry

    registry = get_registry()
    qm = registry.get(qm_name)
    if qm is None:
        return {"error": f"QM {qm_name} not found in registry"}

    corr_id = correlation_id or str(uuid.uuid4()).replace("-", "")[:24]
    test_body = f"VALIDATION_TEST|{corr_id}|{message_body}|{time.time()}"

    try:
        msg_id = await qm.client.put_message(qm.internal_name, queue_name, test_body, corr_id)
    except Exception as exc:
        return {"error": str(exc), "qm": qm_name, "queue": queue_name}

    log.info("validation_put", qm=qm_name, queue=queue_name, corr_id=corr_id, msg_id=msg_id)
    return {
        "status": "put",
        "qm": qm_name,
        "queue": queue_name,
        "correlation_id": corr_id,
        "msg_id": msg_id,
        "sent_at": time.time(),
    }


async def get_test_message(
    qm_name: str,
    queue_name: str,
    correlation_id: str,
    timeout_seconds: int = 5,
) -> dict:
    """Attempt to GET a message by correlation ID, polling until timeout."""
    from bcl.mq.registry import get_registry

    registry = get_registry()
    qm = registry.get(qm_name)
    if qm is None:
        return {
            "status": "error",
            "error": f"QM {qm_name} not found in registry",
            "correlation_id": correlation_id,
            "latency_ms": 0,
        }

    start = time.monotonic()
    deadline = start + timeout_seconds

    while time.monotonic() < deadline:
        try:
            body = await qm.client.get_message(qm.internal_name, queue_name, correlation_id)
        except Exception as exc:
            return {
                "status": "error",
                "error": str(exc),
                "correlation_id": correlation_id,
                "latency_ms": round((time.monotonic() - start) * 1000, 2),
            }
        if body is not None:
            latency_ms = (time.monotonic() - start) * 1000
            log.info(
                "validation_get",
                qm=qm_name,
                queue=queue_name,
                corr_id=correlation_id,
                latency_ms=round(latency_ms, 2),
            )
            return {
                "status": "received",
                "body": body,
                "correlation_id": correlation_id,
                "latency_ms": round(latency_ms, 2),
                "received_at": time.time(),
            }
        await asyncio.sleep(0.5)

    elapsed = round((time.monotonic() - start) * 1000, 2)
    log.warning(
        "validation_timeout",
        qm=qm_name,
        queue=queue_name,
        corr_id=correlation_id,
        elapsed_ms=elapsed,
    )
    return {
        "status": "timeout",
        "body": None,
        "correlation_id": correlation_id,
        "latency_ms": elapsed,
        "error": f"No message received within {timeout_seconds}s",
    }


async def assert_delivery(correlation_id: str, received_result: dict) -> dict:
    """Assert that a message was delivered correctly. Returns pass/fail + latency."""
    if received_result.get("status") == "timeout":
        return {
            "passed": False,
            "correlation_id": correlation_id,
            "latency_ms": received_result.get("latency_ms", 0),
            "reason": "TIMEOUT",
        }

    if received_result.get("status") == "error":
        return {
            "passed": False,
            "correlation_id": correlation_id,
            "latency_ms": received_result.get("latency_ms", 0),
            "reason": received_result.get("error", "ERROR"),
        }

    body = received_result.get("body", "")
    if correlation_id not in body:
        return {
            "passed": False,
            "correlation_id": correlation_id,
            "latency_ms": received_result.get("latency_ms", 0),
            "reason": "CORRELATION_ID_MISMATCH",
        }

    return {
        "passed": True,
        "correlation_id": correlation_id,
        "latency_ms": received_result.get("latency_ms", 0),
        "reason": "DELIVERED",
    }


async def report_result(
    phase: str,
    app_id: str,
    passed: bool,
    latency_ms: float,
    details: str = "",
) -> dict:
    """Persist validation result to Redis and emit audit event."""
    from bcl.state.redis_store import RedisStore

    store = RedisStore()
    result = {
        "phase": phase,
        "app_id": app_id,
        "passed": passed,
        "latency_ms": latency_ms,
        "details": details,
        "timestamp": time.time(),
    }

    r = await store._get_redis()
    await r.lpush(f"validation:{app_id}", json.dumps(result))
    await r.ltrim(f"validation:{app_id}", 0, 99)

    await store.append_audit({
        "operation": "VALIDATION",
        "agent": "validation_agent",
        "qm_target": app_id,
        "app_id": app_id,
        "phase": phase,
        "result": "PASS" if passed else "FAIL",
        "latency_ms": latency_ms,
    })

    return result


async def check_queue_depth(qm_name: str, queue_name: str) -> dict:
    """Check current queue depth."""
    from bcl.mq.registry import get_registry

    registry = get_registry()
    qm = registry.get(qm_name)
    if qm is None:
        return {"error": f"QM {qm_name} not found in registry", "current_depth": -1}

    try:
        r = await qm.client._get_client().get(
            f"{qm.svc_url}/ibmmq/rest/v2/admin/qmgr/{qm.internal_name}/queue/{queue_name}",
            auth=qm.client.auth,
            params={"status": "status"},
        )
        r.raise_for_status()
        data = r.json()
        depth = data.get("queue", [{}])[0].get("status", {}).get("currentDepth", -1)
    except Exception as exc:
        return {"qm": qm_name, "queue": queue_name, "current_depth": -1, "error": str(exc)}

    return {
        "qm": qm_name,
        "queue": queue_name,
        "current_depth": depth,
        "is_empty": depth == 0,
    }


async def check_channel_status(qm_name: str, channel_name: str) -> dict:
    """Check channel status."""
    from bcl.mq.registry import get_registry

    registry = get_registry()
    qm = registry.get(qm_name)
    if qm is None:
        return {"error": f"QM {qm_name} not found in registry", "status": "UNKNOWN"}

    try:
        r = await qm.client._get_client().get(
            f"{qm.svc_url}/ibmmq/rest/v2/admin/qmgr/{qm.internal_name}/channel/{channel_name}",
            auth=qm.client.auth,
            params={"status": "status"},
        )
        r.raise_for_status()
        data = r.json()
        status = data.get("channel", [{}])[0].get("status", {}).get("status", "UNKNOWN")
    except Exception as exc:
        return {"qm": qm_name, "channel": channel_name, "status": "UNKNOWN", "error": str(exc)}

    return {
        "qm": qm_name,
        "channel": channel_name,
        "status": status,
        "running": status == "RUNNING",
    }
