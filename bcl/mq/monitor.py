"""
Background task that polls all QMs every 30s and writes metrics to Prometheus.
Also detects stuck messages (queue depth non-zero for > 2 consecutive poll cycles).
"""
import asyncio
import structlog
from prometheus_client import Gauge, Counter

from bcl.mq.registry import get_registry

log = structlog.get_logger()

QUEUE_DEPTH = Gauge(
    "mq_queue_depth",
    "Current queue depth",
    ["qm_name", "queue_name"],
)
CHANNEL_STATUS = Gauge(
    "mq_channel_running",
    "1 if channel is RUNNING, 0 otherwise",
    ["qm_name", "channel_name"],
)
QM_CONNECTED = Gauge(
    "mq_qm_connected",
    "1 if QM is reachable, 0 otherwise",
    ["qm_name"],
)
STUCK_MESSAGES = Counter(
    "mq_stuck_messages_total",
    "Count of stuck message detections",
    ["qm_name", "queue_name"],
)

_prev_depths: dict = {}


async def monitor_loop():
    """Run forever, polling the MQ fleet every 30 seconds."""
    while True:
        await _poll_all()
        await asyncio.sleep(30)


async def _poll_all():
    registry = get_registry()
    for qm_entry in registry.list_qms():
        try:
            await qm_entry.client.get_qmgr_status()
            QM_CONNECTED.labels(qm_entry.name).set(1)

            queues = await qm_entry.client.list_queues(qm_entry.internal_name)
            for q in queues:
                name = q.get("name", "")
                depth = q.get("status", {}).get("currentDepth", 0)
                QUEUE_DEPTH.labels(qm_entry.name, name).set(depth)

                key = f"{qm_entry.name}:{name}"
                if depth > 0 and _prev_depths.get(key, 0) > 0:
                    STUCK_MESSAGES.labels(qm_entry.name, name).inc()
                    log.warning(
                        "stuck_messages_detected",
                        qm=qm_entry.name,
                        queue=name,
                        depth=depth,
                    )
                _prev_depths[key] = depth

            channels = await qm_entry.client.list_channels(qm_entry.internal_name)
            for ch in channels:
                ch_name = ch.get("name", "")
                status = ch.get("status", {}).get("status", "UNKNOWN")
                CHANNEL_STATUS.labels(qm_entry.name, ch_name).set(
                    1 if status == "RUNNING" else 0
                )

        except Exception as e:
            QM_CONNECTED.labels(qm_entry.name).set(0)
            log.error("qm_poll_failed", qm=qm_entry.name, error=str(e))
