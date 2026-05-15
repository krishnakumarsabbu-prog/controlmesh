"""Seed / mock data for Migration Workspace development."""

import time

MOCK_APPLICATIONS = [
    {
        "id": "app-paymentapi",
        "name": "PaymentAPI",
        "environment": "PROD",
        "domain": "Payments",
        "status": "healthy",
        "producers": [
            {"id": "svc-paymentapi", "name": "PaymentAPI", "type": "producer", "qm": "PAY.QM1", "queue": "PAY.EVENT.OUT", "tps": 5456, "status": "healthy"},
        ],
        "consumers": [
            {"id": "svc-ledgerservice", "name": "LedgerService", "type": "consumer", "qm": "LEDGER.QM2", "queue": "PAY.EVENT.IN", "tps": 5420, "status": "healthy"},
            {"id": "svc-auditservice", "name": "AuditService", "type": "consumer", "qm": "AUDIT.QM2", "queue": "AUDIT.EVENT.IN", "tps": 980, "status": "healthy"},
        ],
    },
    {
        "id": "app-billingservice",
        "name": "BillingService",
        "environment": "PROD",
        "domain": "Billing",
        "status": "healthy",
        "producers": [
            {"id": "svc-billingservice", "name": "BillingService", "type": "producer", "qm": "PAY.QM1", "queue": "BILL.EVENT.OUT", "tps": 1024, "status": "healthy"},
        ],
        "consumers": [
            {"id": "svc-ledgerservice-b", "name": "LedgerService", "type": "consumer", "qm": "LEDGER.QM2", "queue": "BILL.EVENT.IN", "tps": 1024, "status": "healthy"},
        ],
    },
]

MOCK_FLOWS = [
    {
        "id": "flow-payment-event",
        "name": "Payment Event Flow",
        "app_id": "app-paymentapi",
        "source_qm": "PAY.QM1",
        "target_qm": "CLOUD.PAY.QM1",
        "active_path": "source",
        "traffic_split": 0,
        "status": "idle",
    },
]

MOCK_VALIDATION_PHASES = [
    {
        "id": "phase-connectivity",
        "label": "Connectivity",
        "checks": [
            {"id": "chk-qm-reach", "label": "QM Reachability", "status": "passed", "detail": "PAY.QM1 → CLOUD.PAY.QM1 reachable", "latency_ms": 12},
            {"id": "chk-tls", "label": "TLS Handshake", "status": "passed", "detail": "mTLS v1.3 verified", "latency_ms": 8},
        ],
    },
    {
        "id": "phase-topology",
        "label": "Topology Snapshot",
        "checks": [
            {"id": "chk-queues", "label": "Queue Definitions", "status": "passed", "detail": "14 queues verified", "latency_ms": 22},
            {"id": "chk-dlq", "label": "DLQ Policy", "status": "warning", "detail": "DLQ depth above threshold", "latency_ms": 5},
        ],
    },
]
