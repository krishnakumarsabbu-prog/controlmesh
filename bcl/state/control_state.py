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
            "name": "QM1",
            "role": "source",
            "apps": ["AppA", "AppB", "AppC"],
            "queues": [
                {"name": "Q1", "type": "LOCAL", "shared": True},
                {"name": "Q2", "type": "LOCAL", "shared": True},
                {"name": "Q3", "type": "LOCAL", "shared": True},
            ],
        },
        {
            "name": "QM2",
            "role": "source",
            "apps": ["AppD", "AppE", "AppF"],
            "queues": [
                {"name": "Q1", "type": "LOCAL", "shared": True},
                {"name": "Q2", "type": "LOCAL", "shared": True},
                {"name": "Q3", "type": "LOCAL", "shared": True},
            ],
        },
    ],
    "channels": [
        {"name": "QM1.TO.QM2", "from": "QM1", "to": "QM2", "type": "SDR"},
    ],
    "applications": ["AppA", "AppB", "AppC", "AppD", "AppE", "AppF"],
    "total_queue_managers": 2,
    "total_apps": 6,
    "total_channels": 1,
}
