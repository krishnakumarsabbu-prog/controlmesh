"""Mock validation service — simulates source and target MQ topology validation."""

import asyncio
import time
import random
from typing import AsyncGenerator

SOURCE_VALIDATION_CHECKS = [
    {"id": "chk-qm-reach",   "label": "QM Reachability",    "detail": "{source_qm} → {target_qm} reachable",       "latency_ms": 12},
    {"id": "chk-tls",        "label": "TLS Handshake",       "detail": "mTLS v1.3 verified",                        "latency_ms": 8},
    {"id": "chk-auth",       "label": "Auth / CCDT",         "detail": "Service account bound",                     "latency_ms": 4},
    {"id": "chk-queues",     "label": "Queue Definitions",   "detail": "14 queues verified",                        "latency_ms": 22},
    {"id": "chk-channels",   "label": "Channel Config",      "detail": "3 channels active",                         "latency_ms": 18},
    {"id": "chk-dlq",        "label": "DLQ Policy",          "detail": "DLQ depth above threshold on PAY.DLQ",      "latency_ms": 5,  "status_override": "warning"},
    {"id": "chk-roundtrip",  "label": "Message Roundtrip",   "detail": "Probe message delivered in 38ms",           "latency_ms": 38},
    {"id": "chk-ordering",   "label": "Message Ordering",    "detail": "FIFO order maintained",                     "latency_ms": 11},
    {"id": "chk-throughput", "label": "Throughput Baseline", "detail": "12,455 msg/min (above threshold)",          "latency_ms": 0},
]

TARGET_VALIDATION_CHECKS = [
    {"id": "chk-reach",      "label": "QM Reachability",      "detail": "{target_qm} reachable",            "latency_ms": 11},
    {"id": "chk-tls",        "label": "TLS / mTLS Handshake", "detail": "mTLS v1.3 verified",               "latency_ms": 7},
    {"id": "chk-ccdt",       "label": "CCDT Auth Binding",    "detail": "Service account bound",            "latency_ms": 4},
    {"id": "chk-queues",     "label": "Queue Definitions",    "detail": "14 queues provisioned",            "latency_ms": 19},
    {"id": "chk-channels",   "label": "Channel Config",       "detail": "3 channels configured",            "latency_ms": 14},
    {"id": "chk-dlq",        "label": "DLQ Policy",           "detail": "DLQ policy applied",               "latency_ms": 6},
    {"id": "chk-roundtrip",  "label": "Message Roundtrip",    "detail": "Probe delivered in 38ms",          "latency_ms": 38},
    {"id": "chk-ordering",   "label": "Message Ordering",     "detail": "FIFO order maintained",            "latency_ms": 10},
    {"id": "chk-throughput", "label": "Throughput Baseline",  "detail": "12,120 msg/min (above SLA)",       "latency_ms": 0},
]


def _interpolate(text: str, context: dict) -> str:
    for key, value in context.items():
        text = text.replace(f"{{{key}}}", str(value))
    return text


class ValidationService:
    async def stream_source_validation(
        self,
        source_qm: str,
        target_qm: str,
    ) -> AsyncGenerator[dict, None]:
        context = {"source_qm": source_qm, "target_qm": target_qm}
        for check in SOURCE_VALIDATION_CHECKS:
            # running
            yield {
                "type": "check_update",
                "id": check["id"],
                "label": check["label"],
                "status": "running",
                "timestamp": time.time(),
            }
            await asyncio.sleep(0.35 + random.uniform(0, 0.15))

            status = check.get("status_override", "passed")
            yield {
                "type": "check_update",
                "id": check["id"],
                "label": check["label"],
                "status": status,
                "detail": _interpolate(check["detail"], context),
                "latency_ms": check["latency_ms"],
                "timestamp": time.time(),
            }

        yield {"type": "complete", "timestamp": time.time(), "status": "done"}

    async def stream_target_validation(
        self,
        target_qm: str,
    ) -> AsyncGenerator[dict, None]:
        context = {"target_qm": target_qm}
        for check in TARGET_VALIDATION_CHECKS:
            yield {
                "type": "check_update",
                "id": check["id"],
                "label": check["label"],
                "status": "running",
                "timestamp": time.time(),
            }
            await asyncio.sleep(0.38 + random.uniform(0, 0.15))

            yield {
                "type": "check_update",
                "id": check["id"],
                "label": check["label"],
                "status": "passed",
                "detail": _interpolate(check["detail"], context),
                "latency_ms": check["latency_ms"],
                "timestamp": time.time(),
            }

        yield {"type": "complete", "timestamp": time.time(), "status": "done"}

    def run_source_validation(self, source_qm: str, target_qm: str) -> dict:
        context = {"source_qm": source_qm, "target_qm": target_qm}
        checks = []
        for check in SOURCE_VALIDATION_CHECKS:
            checks.append({
                "id": check["id"],
                "label": check["label"],
                "status": check.get("status_override", "passed"),
                "detail": _interpolate(check["detail"], context),
                "latency_ms": check["latency_ms"],
            })
        return {
            "status": "completed",
            "source_qm": source_qm,
            "target_qm": target_qm,
            "checks": checks,
            "completed_at": time.time(),
        }

    def run_target_validation(self, target_qm: str) -> dict:
        context = {"target_qm": target_qm}
        checks = []
        for check in TARGET_VALIDATION_CHECKS:
            checks.append({
                "id": check["id"],
                "label": check["label"],
                "status": "passed",
                "detail": _interpolate(check["detail"], context),
                "latency_ms": check["latency_ms"],
            })
        return {
            "status": "completed",
            "target_qm": target_qm,
            "checks": checks,
            "completed_at": time.time(),
        }
