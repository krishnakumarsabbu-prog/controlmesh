"""
Quick smoke-test / demo script.
Run: python scripts/demo_db.py

Requires a Redis server on localhost:6379 (or set REDIS_HOST / REDIS_PORT).
SQLite runs entirely in-process — no server needed.
"""

import logging
import sys
import os

# Allow running from repo root without installing the package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s — %(message)s")

from db.manager import get_manager
from db import shutdown_all


def main() -> None:
    mgr = get_manager()

    # 1. Health check
    print("\n--- Health ---")
    print(mgr.health())

    # 2. Register Phase-1 source queue managers
    print("\n--- Registering QMs ---")
    mgr.register_qm("QM.SRC.A", "source", "qm-src-a-svc", port=1414)
    mgr.register_qm("QM.SRC.B", "source", "qm-src-b-svc", port=1414)

    # 3. Simulate a state transition
    mgr.update_qm_state("QM.SRC.A", "running")
    mgr.update_qm_state("QM.SRC.B", "running")

    # 4. Read back (second call should hit Redis cache)
    print("\n--- QM.SRC.A record ---")
    print(mgr.get_qm("QM.SRC.A"))

    print("\n--- All source QMs ---")
    for qm in mgr.list_qms(role="source"):
        print(" ", qm)

    # 5. Migration state machine
    print("\n--- Migration state machine ---")
    mgr.init_migration("app-payments")
    mgr.advance_phase("app-payments", "topology_snapshot",
                       checkpoint={"source_qm": "QM.SRC.A", "queues": ["PAY.IN", "PAY.OUT"]})
    mgr.advance_phase("app-payments", "traffic_mirror")
    print(mgr.get_migration_state("app-payments"))
    print("Checkpoint:", mgr.get_checkpoint("app-payments"))

    # 6. Audit log
    print("\n--- Audit log (last 5) ---")
    for entry in mgr.get_audit_log(limit=5):
        print(" ", entry)

    # 7. Cleanup
    shutdown_all()
    print("\nDone.")


if __name__ == "__main__":
    main()
