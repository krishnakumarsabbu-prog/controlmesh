"""Core workspace service — manages applications, flows, and migration sessions."""

import time
import uuid
from typing import Optional
from ..models.workspace import WorkspaceApplication, WorkspaceFlow, WorkspaceTimelineEvent, RuntimeLogEntry

# In-memory store (keyed by session_id)
_sessions: dict[str, dict] = {}

# Application registry (can be seeded or mutated via API)
_applications: dict[str, dict] = {
    "app-paymentapi": {
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
    "app-billingservice": {
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
    "app-notifyservice": {
        "id": "app-notifyservice",
        "name": "NotifyService",
        "environment": "STAGING",
        "domain": "Notifications",
        "status": "degraded",
        "producers": [
            {"id": "svc-notifyservice", "name": "NotifyService", "type": "producer", "qm": "NOTIFY.QM1", "queue": "NOTIFY.EVENT.OUT", "tps": 312, "status": "degraded"},
        ],
        "consumers": [
            {"id": "svc-emailworker", "name": "EmailWorker", "type": "consumer", "qm": "NOTIFY.QM2", "queue": "NOTIFY.EVENT.IN", "tps": 305, "status": "healthy"},
        ],
    },
}

_flows: dict[str, dict] = {
    "flow-payment-event": {
        "id": "flow-payment-event",
        "name": "Payment Event Flow",
        "app_id": "app-paymentapi",
        "source_qm": "PAY.QM1",
        "target_qm": "CLOUD.PAY.QM1",
        "active_path": "source",
        "traffic_split": 0,
        "status": "idle",
    },
    "flow-bill-event": {
        "id": "flow-bill-event",
        "name": "Bill Event Flow",
        "app_id": "app-billingservice",
        "source_qm": "PAY.QM1",
        "target_qm": "CLOUD.PAY.QM1",
        "active_path": "source",
        "traffic_split": 0,
        "status": "idle",
    },
    "flow-notify-event": {
        "id": "flow-notify-event",
        "name": "Notify Event Flow",
        "app_id": "app-notifyservice",
        "source_qm": "NOTIFY.QM1",
        "target_qm": "CLOUD.NOTIFY.QM1",
        "active_path": "source",
        "traffic_split": 0,
        "status": "idle",
    },
}


class WorkspaceService:
    def list_applications(self) -> list[dict]:
        return list(_applications.values())

    def get_application(self, app_id: str) -> Optional[dict]:
        return _applications.get(app_id)

    def list_flows(self, app_id: Optional[str] = None) -> list[dict]:
        flows = list(_flows.values())
        if app_id:
            flows = [f for f in flows if f["app_id"] == app_id]
        return flows

    def get_flow(self, flow_id: str) -> Optional[dict]:
        return _flows.get(flow_id)

    def update_flow(self, flow_id: str, updates: dict) -> Optional[dict]:
        if flow_id not in _flows:
            return None
        _flows[flow_id].update(updates)
        return _flows[flow_id]

    def create_session(self, app_id: str, flow_id: str) -> dict:
        session_id = f"session-{uuid.uuid4().hex[:10]}"
        session = {
            "id": session_id,
            "app_id": app_id,
            "flow_id": flow_id,
            "created_at": time.time(),
            "current_step": "app-mapping",
            "timeline": [],
            "logs": [],
            "traffic_split": 0,
        }
        _sessions[session_id] = session
        return session

    def get_session(self, session_id: str) -> Optional[dict]:
        return _sessions.get(session_id)

    def add_session_log(self, session_id: str, level: str, service: str, message: str) -> dict:
        entry = {
            "id": f"log-{uuid.uuid4().hex[:8]}",
            "timestamp": time.time(),
            "level": level,
            "service": service,
            "message": message,
        }
        if session_id in _sessions:
            _sessions[session_id]["logs"].append(entry)
        return entry

    def add_timeline_event(self, session_id: str, event_type: str, title: str, detail: str, step: str) -> dict:
        event = {
            "id": f"evt-{uuid.uuid4().hex[:8]}",
            "timestamp": time.time(),
            "type": event_type,
            "title": title,
            "detail": detail,
            "step": step,
        }
        if session_id in _sessions:
            _sessions[session_id]["timeline"].append(event)
        return event

    def get_live_metrics(self, app_id: str) -> dict:
        app = _applications.get(app_id)
        if not app:
            return {}
        total_tps = sum(s["tps"] for s in app.get("producers", []) + app.get("consumers", []))
        healthy_consumers = sum(1 for s in app.get("consumers", []) if s["status"] == "healthy")
        total_consumers = len(app.get("consumers", []))
        return {
            "active_path": "SOURCE",
            "traffic_msg_per_min": total_tps,
            "success_rate": 99.92,
            "avg_latency_ms": 42,
            "error_rate": 0.02,
            "consumers_up": f"{healthy_consumers} / {total_consumers}",
        }
