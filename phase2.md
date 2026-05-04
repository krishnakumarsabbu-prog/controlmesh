# Phase 2: BCL Gateway Core Implementation

**Duration:** 3–4 days
**Objective:** Build the Business Control Layer (BCL) — the single unified API surface that governs all MQ operations, enforces policy, and is the only entry point for every agent and UI action.

---

## Context and Rationale

The BCL is the most critical component in the architecture. It sits between the React UI / ADK agents and the raw IBM MQ REST Admin API. Its job is threefold:

1. **Unify** — callers interact with one API regardless of how many queue managers are running.
2. **Enforce** — naming conventions, DLQ requirements, TLS, MCA auth, cross-zone rules are checked synchronously before any MQ object is touched.
3. **Audit** — every operation is logged with trace ID, QM target, operator identity, and outcome.

Nothing bypasses the BCL. The ADK agents, the UI, and any test tooling all go through it.

---

## Architecture

```
React UI / ADK Agents
        │
        ▼  REST/JSON (JWT auth)
┌─────────────────────────────────────────────┐
│           BCL FastAPI Gateway               │
│                                             │
│  ┌─────────────┐  ┌──────────────────────┐ │
│  │ API Router   │  │   Policy Engine      │ │
│  │ /fleet       │  │ naming + DLQ + TLS   │ │
│  │ /queues      │  │ + MCA + cross-zone   │ │
│  │ /channels    │  └──────────────────────┘ │
│  │ /migrate     │  ┌──────────────────────┐ │
│  │ /validate    │  │   State Store        │ │
│  │ /audit       │  │   Redis              │ │
│  │ /healthz     │  └──────────────────────┘ │
│  └─────────────┘  ┌──────────────────────┐ │
│                    │   Observability      │ │
│                    │   structlog + /metrics│ │
│                    └──────────────────────┘ │
└─────────────────────────────────────────────┘
        │
        ▼  IBM MQ REST Admin API (HTTPS :9443)
    MQ Fleet pods
```

---

## Project Structure

```
bcl/
├── main.py                    # FastAPI app entrypoint
├── routers/
│   ├── fleet.py               # GET /api/fleet
│   ├── queues.py              # CRUD /api/queues
│   ├── channels.py            # CRUD /api/channels
│   ├── migration.py           # POST /api/migration/execute
│   ├── validation.py          # POST /api/validate
│   └── audit.py               # GET /api/audit
├── policy/
│   ├── engine.py              # Synchronous policy runner
│   ├── naming.py              # Regex validators
│   ├── dlq.py                 # DLQ enforcement
│   ├── tls.py                 # TLS/encryption checks
│   └── mca.py                 # MCA authz checks
├── mq/
│   ├── client.py              # MQ REST API wrapper
│   └── registry.py            # QM fleet registry
├── state/
│   └── redis_store.py         # Snapshot / checkpoint ops
├── observability/
│   ├── logging.py             # structlog JSON setup
│   └── metrics.py             # Prometheus counters/histograms
├── models/
│   ├── queue_manager.py
│   ├── queue.py
│   ├── channel.py
│   └── migration.py
├── tests/
│   ├── test_policy.py
│   ├── test_mq_client.py
│   └── test_migration.py
├── Dockerfile
└── requirements.txt
```

---

## Core Implementation

### 2.1 FastAPI Application

```python
# bcl/main.py
import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import make_asgi_app
import uuid, time

from routers import fleet, queues, channels, migration, validation, audit
from observability.logging import configure_logging
from observability.metrics import REQUEST_LATENCY, REQUEST_COUNT

configure_logging()
log = structlog.get_logger()

app = FastAPI(
    title="BCL Gateway",
    description="Business Control Layer for IBM MQ Topology Migration",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

# Prometheus metrics endpoint
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

@app.middleware("http")
async def observability_middleware(request: Request, call_next):
    trace_id = str(uuid.uuid4())
    request.state.trace_id = trace_id
    start = time.monotonic()
    response = await call_next(request)
    duration_ms = (time.monotonic() - start) * 1000
    log.info("request",
             trace_id=trace_id,
             method=request.method,
             path=request.url.path,
             status=response.status_code,
             duration_ms=round(duration_ms, 2))
    REQUEST_LATENCY.labels(request.url.path).observe(duration_ms / 1000)
    REQUEST_COUNT.labels(request.url.path, response.status_code).inc()
    return response

app.include_router(fleet.router, prefix="/api")
app.include_router(queues.router, prefix="/api")
app.include_router(channels.router, prefix="/api")
app.include_router(migration.router, prefix="/api")
app.include_router(validation.router, prefix="/api")
app.include_router(audit.router, prefix="/api")

@app.get("/healthz/live")
async def liveness():
    return {"status": "alive"}

@app.get("/healthz/ready")
async def readiness():
    from mq.registry import get_registry
    registry = get_registry()
    reachable = await registry.check_any_qm_reachable()
    if not reachable:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="No MQ QMs reachable")
    return {"status": "ready", "qm_count": len(registry.list_qms())}
```

---

### 2.2 Policy Engine

The policy engine runs **synchronously** before any agent is invoked. HTTP 422 is returned immediately on violation.

```python
# bcl/policy/engine.py
from fastapi import HTTPException
from .naming import validate_naming
from .dlq import check_dlq_configured
from .tls import check_tls_required
from .mca import check_mca_authz
import structlog

log = structlog.get_logger()

class PolicyViolation(Exception):
    def __init__(self, rule: str, detail: str):
        self.rule = rule
        self.detail = detail

async def enforce_pre_operation(operation: dict, qm_name: str) -> None:
    violations = []

    # 1. Naming conventions
    naming_errors = validate_naming(operation)
    violations.extend(naming_errors)

    # 2. DLQ enforcement (every QM must have DLQ before any other queue)
    if operation.get("type") == "create_queue":
        dlq_ok = await check_dlq_configured(qm_name)
        if not dlq_ok:
            violations.append({
                "rule": "DLQ_REQUIRED",
                "detail": f"QM {qm_name} has no Dead Letter Queue configured"
            })

    # 3. TLS/encryption check
    if operation.get("type") in ("create_channel", "update_channel"):
        tls_errors = check_tls_required(operation)
        violations.extend(tls_errors)

    # 4. MCA authz check
    if operation.get("type") in ("create_channel", "update_channel"):
        mca_errors = check_mca_authz(operation)
        violations.extend(mca_errors)

    if violations:
        log.warning("policy_violation", violations=violations, qm=qm_name)
        raise HTTPException(status_code=422, detail={
            "error": "POLICY_VIOLATION",
            "violations": violations
        })
```

```python
# bcl/policy/naming.py
import re

# Enterprise naming patterns
PATTERNS = {
    "queue_manager": re.compile(r'^QM\.[A-Z]+\.[A-Z0-9]+$'),
    "queue":         re.compile(r'^Q\.[A-Z0-9]+\.[A-Z0-9]+\.(LOCAL|REMOTE|XMIT|DLQ)$'),
    "channel":       re.compile(r'^CHL\.[A-Z0-9]+\.[A-Z0-9]+$'),
    "listener":      re.compile(r'^LST\.[A-Z0-9]+\.[0-9]+$'),
}

def validate_naming(operation: dict) -> list:
    violations = []
    obj_type = operation.get("object_type")
    name = operation.get("name", "")

    pattern = PATTERNS.get(obj_type)
    if pattern and not pattern.match(name):
        violations.append({
            "rule": "NAMING_CONVENTION",
            "detail": f"{obj_type} name '{name}' does not match pattern {pattern.pattern}"
        })
    return violations
```

```python
# bcl/policy/tls.py
def check_tls_required(operation: dict) -> list:
    violations = []
    channel_type = operation.get("channel_type", "")
    ssl_cipher = operation.get("ssl_cipher_spec", "")

    # All channels must have SSL cipher suite configured
    if not ssl_cipher:
        violations.append({
            "rule": "TLS_REQUIRED",
            "detail": f"Channel {operation.get('name')} must have sslCipherSpec configured"
        })

    # Cross-region: must be SVRCONN or SDR/RCV
    if operation.get("cross_region") and channel_type not in ("SVRCONN", "SDR", "RCVR"):
        violations.append({
            "rule": "CROSS_REGION_CHANNEL_TYPE",
            "detail": "Cross-region traffic must flow via QM-to-QM channels (SDR/RCVR)"
        })

    # Cross-zone: must be SVRCONN
    if operation.get("cross_zone") and channel_type != "SVRCONN":
        violations.append({
            "rule": "CROSS_ZONE_CHANNEL_TYPE",
            "detail": "Cross-zone connections must use server-connection channels (SVRCONN)"
        })
    return violations
```

---

### 2.3 MQ REST Client

```python
# bcl/mq/client.py
import httpx
import structlog
from typing import Optional

log = structlog.get_logger()

class MQRestClient:
    def __init__(self, base_url: str, username: str, password: str):
        self.base_url = base_url.rstrip("/")
        self.auth = (username, password)
        self.client = httpx.AsyncClient(verify=False, timeout=30.0)

    async def get_qmgr_status(self) -> dict:
        r = await self.client.get(
            f"{self.base_url}/ibmmq/rest/v2/admin/qmgr",
            auth=self.auth
        )
        r.raise_for_status()
        return r.json()

    async def create_queue(self, qmgr: str, name: str, props: dict) -> dict:
        payload = {"name": name, **props}
        r = await self.client.post(
            f"{self.base_url}/ibmmq/rest/v2/admin/qmgr/{qmgr}/queue",
            json=payload, auth=self.auth,
            headers={"Content-Type": "application/json",
                     "ibm-mq-rest-csrf-token": "blank"}
        )
        r.raise_for_status()
        log.info("mq_create_queue", qmgr=qmgr, name=name, status=r.status_code)
        return r.json()

    async def create_channel(self, qmgr: str, name: str, props: dict) -> dict:
        payload = {"name": name, **props}
        r = await self.client.post(
            f"{self.base_url}/ibmmq/rest/v2/admin/qmgr/{qmgr}/channel",
            json=payload, auth=self.auth,
            headers={"ibm-mq-rest-csrf-token": "blank"}
        )
        r.raise_for_status()
        return r.json()

    async def delete_queue(self, qmgr: str, name: str) -> None:
        r = await self.client.delete(
            f"{self.base_url}/ibmmq/rest/v2/admin/qmgr/{qmgr}/queue/{name}",
            auth=self.auth,
            headers={"ibm-mq-rest-csrf-token": "blank"}
        )
        r.raise_for_status()

    async def put_message(self, qmgr: str, queue: str, body: str,
                          correlation_id: Optional[str] = None) -> str:
        headers = {
            "Content-Type": "text/plain",
            "ibm-mq-rest-csrf-token": "blank"
        }
        if correlation_id:
            headers["ibm-mq-md-correlId"] = correlation_id
        r = await self.client.post(
            f"{self.base_url}/ibmmq/rest/v1/messaging/qmgr/{qmgr}/queue/{queue}/message",
            content=body.encode(), auth=self.auth, headers=headers
        )
        r.raise_for_status()
        return r.headers.get("ibm-mq-md-msgId", "")

    async def get_message(self, qmgr: str, queue: str,
                          correlation_id: Optional[str] = None) -> Optional[str]:
        headers = {"ibm-mq-rest-csrf-token": "blank"}
        if correlation_id:
            headers["ibm-mq-md-correlId"] = correlation_id
        r = await self.client.delete(
            f"{self.base_url}/ibmmq/rest/v1/messaging/qmgr/{qmgr}/queue/{queue}/message",
            auth=self.auth, headers=headers
        )
        if r.status_code == 204:
            return None
        r.raise_for_status()
        return r.text
```

---

### 2.4 Fleet Registry

```python
# bcl/mq/registry.py
from dataclasses import dataclass, field
from typing import Dict, List
from .client import MQRestClient
import os

@dataclass
class QueueManagerEntry:
    name: str           # logical name e.g. QM.SRC.A
    internal_name: str  # MQ internal name e.g. QMSRCA
    svc_url: str        # https://qm-src-a-svc:9443
    role: str           # source | target
    client: MQRestClient = field(repr=False)

_registry: Dict[str, QueueManagerEntry] = {}

def get_registry():
    return _RegistryProxy()

class _RegistryProxy:
    def register(self, entry: QueueManagerEntry):
        _registry[entry.name] = entry

    def get(self, logical_name: str) -> QueueManagerEntry:
        if logical_name not in _registry:
            raise KeyError(f"QM {logical_name} not in registry")
        return _registry[logical_name]

    def list_qms(self) -> List[QueueManagerEntry]:
        return list(_registry.values())

    async def check_any_qm_reachable(self) -> bool:
        for entry in _registry.values():
            try:
                await entry.client.get_qmgr_status()
                return True
            except Exception:
                continue
        return False

def bootstrap_registry():
    """Populate registry from environment / OCP service discovery."""
    admin_pw = os.environ["MQ_ADMIN_PASSWORD"]
    source_qms = [
        ("QM.SRC.A", "QMSRCA", "https://qm-src-a-svc:9443"),
        ("QM.SRC.B", "QMSRCB", "https://qm-src-b-svc:9443"),
    ]
    proxy = get_registry()
    for logical, internal, url in source_qms:
        proxy.register(QueueManagerEntry(
            name=logical, internal_name=internal,
            svc_url=url, role="source",
            client=MQRestClient(url, "admin", admin_pw)
        ))
```

---

### 2.5 Fleet Router

```python
# bcl/routers/fleet.py
from fastapi import APIRouter
from mq.registry import get_registry

router = APIRouter(tags=["fleet"])

@router.get("/fleet")
async def list_fleet():
    registry = get_registry()
    return {
        "queue_managers": [
            {
                "name": qm.name,
                "internal_name": qm.internal_name,
                "svc_url": qm.svc_url,
                "role": qm.role,
            }
            for qm in registry.list_qms()
        ]
    }

@router.get("/fleet/{qm_name}/status")
async def qm_status(qm_name: str):
    registry = get_registry()
    qm = registry.get(qm_name)
    status = await qm.client.get_qmgr_status()
    return {"qm": qm_name, "status": status}
```

---

### 2.6 Audit Trail

```python
# bcl/routers/audit.py
from fastapi import APIRouter, Query
from state.redis_store import RedisStore
from typing import Optional

router = APIRouter(tags=["audit"])

@router.get("/audit")
async def get_audit_log(
    limit: int = Query(100, le=1000),
    operation: Optional[str] = None,
    qm: Optional[str] = None,
):
    store = RedisStore()
    events = await store.get_audit_events(limit=limit,
                                          filter_operation=operation,
                                          filter_qm=qm)
    return {"events": events, "count": len(events)}
```

Every BCL operation appends to Redis sorted set `audit:events` with score = Unix timestamp:

```python
# bcl/state/redis_store.py (audit methods)
import json, time
import aioredis

class RedisStore:
    async def append_audit(self, event: dict):
        r = await self._get_redis()
        event["timestamp"] = time.time()
        await r.zadd("audit:events", {json.dumps(event): event["timestamp"]})

    async def get_audit_events(self, limit: int = 100,
                               filter_operation=None, filter_qm=None) -> list:
        r = await self._get_redis()
        raw = await r.zrevrange("audit:events", 0, limit - 1)
        events = [json.loads(e) for e in raw]
        if filter_operation:
            events = [e for e in events if e.get("operation") == filter_operation]
        if filter_qm:
            events = [e for e in events if e.get("qm_target") == filter_qm]
        return events
```

---

## OpenAPI Endpoint Summary

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/fleet` | List all QMs in registry |
| GET | `/api/fleet/{qm}/status` | Live status from MQ REST API |
| POST | `/api/queues` | Create queue (policy enforced) |
| GET | `/api/queues?qm={qm}` | List queues on a QM |
| DELETE | `/api/queues/{name}` | Delete queue |
| POST | `/api/channels` | Create channel (policy enforced) |
| GET | `/api/channels?qm={qm}` | List channels |
| POST | `/api/migration/execute` | Trigger migration step |
| GET | `/api/migration/status` | Get all app migration states |
| POST | `/api/validate` | Run validation for app/QM |
| GET | `/api/audit` | Query audit log |
| GET | `/healthz/live` | Liveness probe |
| GET | `/healthz/ready` | Readiness probe (checks MQ) |
| GET | `/metrics` | Prometheus metrics |

---

## OCP Deployment

```yaml
# ocp/bcl/bcl-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bcl-gateway
  namespace: mq-hackathon
spec:
  replicas: 2
  selector:
    matchLabels:
      app: bcl-gateway
  template:
    metadata:
      labels:
        app: bcl-gateway
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8000"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: bcl-gateway
      containers:
      - name: bcl
        image: bcl-gateway:latest
        ports:
        - containerPort: 8000
        env:
        - name: MQ_ADMIN_PASSWORD
          valueFrom:
            secretKeyRef:
              name: mq-admin-creds
              key: password
        - name: REDIS_URL
          value: "redis://:$(REDIS_PASSWORD)@redis-svc:6379"
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: redis-creds
              key: password
        resources:
          requests:
            cpu: 200m
            memory: 256Mi
        livenessProbe:
          httpGet:
            path: /healthz/live
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 15
        readinessProbe:
          httpGet:
            path: /healthz/ready
            port: 8000
          initialDelaySeconds: 15
          periodSeconds: 10
```

---

## Success Criteria

| Criterion | Verification |
|-----------|-------------|
| BCL accepts requests | `curl /api/fleet` returns QM list |
| Policy engine blocks violations | POST queue with bad name returns HTTP 422 |
| Audit log captures operations | `GET /api/audit` shows entries |
| Health probes pass | `GET /healthz/ready` returns 200 |
| OpenAPI docs accessible | `GET /api/docs` renders Swagger UI |
| Structured logs emitted | `oc logs` shows JSON lines |
| Prometheus metrics scraped | Grafana BCL dashboard shows data |
