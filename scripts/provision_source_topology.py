"""
Evidence script: provisions the full source topology via BCL API.
Run once at the start of the hackathon demo.

Usage:
    BCL_URL=http://bcl-gateway-svc:8000/api python scripts/provision_source_topology.py
"""
import os
import sys

import httpx

BCL_URL = os.environ.get("BCL_URL", "http://bcl-gateway-svc:8000/api")

SOURCE_TOPOLOGY = {
    "QM.SRC.A": {
        "apps": ["APP1", "APP2", "APP3"],
        "dlq": "Q.SRCA.DLQ.LOCAL",
        "queues": [
            "Q.APP1.REQUEST.LOCAL",
            "Q.APP1.RESPONSE.LOCAL",
            "Q.APP2.REQUEST.LOCAL",
            "Q.APP2.RESPONSE.LOCAL",
            "Q.APP3.REQUEST.LOCAL",
            "Q.APP3.RESPONSE.LOCAL",
        ],
    },
    "QM.SRC.B": {
        "apps": ["APP4", "APP5", "APP6"],
        "dlq": "Q.SRCB.DLQ.LOCAL",
        "queues": [
            "Q.APP4.REQUEST.LOCAL",
            "Q.APP4.RESPONSE.LOCAL",
            "Q.APP5.REQUEST.LOCAL",
            "Q.APP5.RESPONSE.LOCAL",
            "Q.APP6.REQUEST.LOCAL",
            "Q.APP6.RESPONSE.LOCAL",
        ],
    },
}


def provision() -> None:
    with httpx.Client(timeout=30) as client:
        for qm_name, config in SOURCE_TOPOLOGY.items():
            print(f"Provisioning {qm_name}...")

            # DLQ must be created first
            dlq = config["dlq"]
            r = client.post(
                f"{BCL_URL}/queues",
                json={"qm": qm_name, "name": dlq, "type": "LOCAL"},
            )
            if r.status_code != 200:
                print(f"  ERROR creating DLQ {dlq}: {r.text}", file=sys.stderr)
                sys.exit(1)
            print(f"  DLQ created: {dlq}")

            # Application queues
            for q in config["queues"]:
                r = client.post(
                    f"{BCL_URL}/queues",
                    json={"qm": qm_name, "name": q, "type": "LOCAL"},
                )
                if r.status_code != 200:
                    print(f"  ERROR creating queue {q}: {r.text}", file=sys.stderr)
                    sys.exit(1)
                print(f"  Queue created: {q}")

            print(f"Provisioned {qm_name} ({len(config['queues']) + 1} objects)")


if __name__ == "__main__":
    provision()
