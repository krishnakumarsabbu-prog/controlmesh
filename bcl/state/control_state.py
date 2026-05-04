"""
Global in-memory control state for the BCL unified system view.

Tracks the fleet-wide topology, migration plan, execution state, and
a rolling log — all queue managers are treated as one logical system.
"""
import time
from dataclasses import dataclass, field
from typing import Any


class ExecutionState:
    IDLE = "IDLE"
    PLANNING = "PLANNING"
    EXECUTING = "EXECUTING"
    VALIDATING = "VALIDATING"
    FAILED = "FAILED"
    ROLLED_BACK = "ROLLED_BACK"


@dataclass
class ControlState:
    topology: dict = field(default_factory=dict)
    migration_plan: list = field(default_factory=list)
    execution_state: str = ExecutionState.IDLE
    logs: list = field(default_factory=list)


_state = ControlState()


def get_state() -> ControlState:
    return _state


def append_log(message: str, level: str = "INFO", **extra: Any) -> None:
    _state.logs.append(
        {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "level": level,
            "message": message,
            **extra,
        }
    )


def set_execution_state(new_state: str) -> None:
    append_log(f"Execution state changed: {_state.execution_state} -> {new_state}")
    _state.execution_state = new_state


SOURCE_TOPOLOGY: dict = {
    "queue_managers": [
        {
            "name": "QM.SRC.A",
            "internal_name": "QMSRCA",
            "role": "source",
            "dlq": "Q.SRCA.DLQ.LOCAL",
            "apps": ["APP1", "APP2", "APP3"],
            "queues": [
                {"name": "Q.APP1.REQUEST.LOCAL", "type": "LOCAL"},
                {"name": "Q.APP1.RESPONSE.LOCAL", "type": "LOCAL"},
                {"name": "Q.APP2.REQUEST.LOCAL", "type": "LOCAL"},
                {"name": "Q.APP2.RESPONSE.LOCAL", "type": "LOCAL"},
                {"name": "Q.APP3.REQUEST.LOCAL", "type": "LOCAL"},
                {"name": "Q.APP3.RESPONSE.LOCAL", "type": "LOCAL"},
            ],
        },
        {
            "name": "QM.SRC.B",
            "internal_name": "QMSRCB",
            "role": "source",
            "dlq": "Q.SRCB.DLQ.LOCAL",
            "apps": ["APP4", "APP5", "APP6"],
            "queues": [
                {"name": "Q.APP4.REQUEST.LOCAL", "type": "LOCAL"},
                {"name": "Q.APP4.RESPONSE.LOCAL", "type": "LOCAL"},
                {"name": "Q.APP5.REQUEST.LOCAL", "type": "LOCAL"},
                {"name": "Q.APP5.RESPONSE.LOCAL", "type": "LOCAL"},
                {"name": "Q.APP6.REQUEST.LOCAL", "type": "LOCAL"},
                {"name": "Q.APP6.RESPONSE.LOCAL", "type": "LOCAL"},
            ],
        },
    ],
    "total_queue_managers": 2,
    "total_apps": 6,
}
