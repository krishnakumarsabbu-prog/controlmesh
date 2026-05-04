# Phase 10: IBM MQ Integration Layer

**Duration:** 2–3 days
**Objective:** Implement the comprehensive IBM MQ integration layer — connection management, queue/channel operations, queue monitoring, message transformation, and MQ-specific error handling — used by all agents through the BCL.

---

## Context and Rationale

Every agent tool that touches IBM MQ calls the IBM MQ REST Admin API at `HTTPS://<pod-svc>:9443/ibmmq/rest/v2/`. Phase 10 hardens this integration: connection pooling, retry logic, structured error mapping, and a complete queue monitoring subsystem that feeds the Grafana dashboards and the UI validation panel.

The MQ integration layer is the lowest level of the stack that is owned by this codebase. Below it is the IBM MQ container image itself.

---

## IBM MQ REST API Reference

| Operation | Method | Path |
|-----------|--------|------|
| List QM status | GET | `/ibmmq/rest/v2/admin/qmgr` |
| Create queue | POST | `/ibmmq/rest/v2/admin/qmgr/{qmgr}/queue` |
| Get queue | GET | `/ibmmq/rest/v2/admin/qmgr/{qmgr}/queue/{name}` |
| Delete queue | DELETE | `/ibmmq/rest/v2/admin/qmgr/{qmgr}/queue/{name}` |
| Create channel | POST | `/ibmmq/rest/v2/admin/qmgr/{qmgr}/channel` |
| Start channel | POST | `/ibmmq/rest/v2/admin/action/qmgr/{qmgr}/channel/{name}/start` |
| Stop channel | POST | `/ibmmq/rest/v2/admin/action/qmgr/{qmgr}/channel/{name}/stop` |
| Put message | POST | `/ibmmq/rest/v1/messaging/qmgr/{qmgr}/queue/{name}/message` |
| Get message | DELETE | `/ibmmq/rest/v1/messaging/qmgr/{qmgr}/queue/{name}/message` |
| Queue status | GET | `/ibmmq/rest/v2/admin/qmgr/{qmgr}/queue/{name}?status=status` |

Required headers for all mutating operations:
```
ibm-mq-rest-csrf-token: blank
Content-Type: application/json
Authorization: Basic <base64(admin:password)>
```

---

## Enhanced MQ REST Client

```python
# bcl/mq/client.py (enhanced)
import httpx
import asyncio
import structlog
from typing import Optional, Any
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

log = structlog.get_logger()

class MQError(Exception):
    def __init__(self, operation: str, status_code: int, detail: str):
        self.operation = operation
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"MQ {operation} failed ({status_code}): {detail}")

class MQRestClient:
    def __init__(self, base_url: str, username: str, password: str):
        self.base_url = base_url.rstrip("/")
        self.auth = (username, password)
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                verify=False,
                timeout=httpx.Timeout(connect=5.0, read=30.0, write=10.0, pool=5.0),
                limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
            )
        return self._client

    def _csrf_headers(self, content_type: str = "application/json") -> dict:
        return {
            "ibm-mq-rest-csrf-token": "blank",
            "Content-Type": content_type,
        }

    def _map_mq_error(self, r: httpx.Response, operation: str) -> MQError:
        try:
            body = r.json()
            detail = body.get("error", [{}])[0].get("message", r.text)
        except Exception:
            detail = r.text
        return MQError(operation, r.status_code, detail)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type(httpx.TransportError),
    )
    async def get_qmgr_status(self) -> dict:
        r = await self.client.get(
            f"{self.base_url}/ibmmq/rest/v2/admin/qmgr",
            auth=self.auth
        )
        if not r.is_success:
            raise self._map_mq_error(r, "GET_QMGR_STATUS")
        return r.json()

    async def list_queues(self, qmgr: str,
                          name_pattern: str = "*") -> list:
        r = await self.client.get(
            f"{self.base_url}/ibmmq/rest/v2/admin/qmgr/{qmgr}/queue",
            auth=self.auth,
            params={"name": name_pattern}
        )
        if not r.is_success:
            raise self._map_mq_error(r, "LIST_QUEUES")
        return r.json().get("queue", [])

    async def create_queue(self, qmgr: str, name: str,
                           props: dict) -> dict:
        r = await self.client.post(
            f"{self.base_url}/ibmmq/rest/v2/admin/qmgr/{qmgr}/queue",
            json={"name": name, **props},
            auth=self.auth,
            headers=self._csrf_headers()
        )
        if not r.is_success:
            raise self._map_mq_error(r, "CREATE_QUEUE")
        log.info("mq_create_queue", qmgr=qmgr, name=name)
        return r.json() if r.content else {"name": name, "status": "created"}

    async def get_queue(self, qmgr: str, name: str,
                        include_status: bool = False) -> dict:
        params = {"status": "status"} if include_status else {}
        r = await self.client.get(
            f"{self.base_url}/ibmmq/rest/v2/admin/qmgr/{qmgr}/queue/{name}",
            auth=self.auth,
            params=params
        )
        if r.status_code == 404:
            return None
        if not r.is_success:
            raise self._map_mq_error(r, "GET_QUEUE")
        queues = r.json().get("queue", [])
        return queues[0] if queues else None

    async def delete_queue(self, qmgr: str, name: str) -> None:
        r = await self.client.delete(
            f"{self.base_url}/ibmmq/rest/v2/admin/qmgr/{qmgr}/queue/{name}",
            auth=self.auth,
            headers=self._csrf_headers()
        )
        if r.status_code == 404:
            return  # Already absent — idempotent
        if not r.is_success:
            raise self._map_mq_error(r, "DELETE_QUEUE")

    async def create_channel(self, qmgr: str, name: str,
                              props: dict) -> dict:
        r = await self.client.post(
            f"{self.base_url}/ibmmq/rest/v2/admin/qmgr/{qmgr}/channel",
            json={"name": name, **props},
            auth=self.auth,
            headers=self._csrf_headers()
        )
        if not r.is_success:
            raise self._map_mq_error(r, "CREATE_CHANNEL")
        return r.json() if r.content else {"name": name, "status": "created"}

    async def list_channels(self, qmgr: str) -> list:
        r = await self.client.get(
            f"{self.base_url}/ibmmq/rest/v2/admin/qmgr/{qmgr}/channel",
            auth=self.auth
        )
        if not r.is_success:
            raise self._map_mq_error(r, "LIST_CHANNELS")
        return r.json().get("channel", [])

    async def put_message(self, qmgr: str, queue: str,
                           body: str,
                           correlation_id: Optional[str] = None) -> str:
        headers = self._csrf_headers("text/plain")
        if correlation_id:
            headers["ibm-mq-md-correlId"] = correlation_id
        r = await self.client.post(
            f"{self.base_url}/ibmmq/rest/v1/messaging/qmgr/{qmgr}"
            f"/queue/{queue}/message",
            content=body.encode("utf-8"),
            auth=self.auth,
            headers=headers
        )
        if not r.is_success:
            raise self._map_mq_error(r, "PUT_MESSAGE")
        return r.headers.get("ibm-mq-md-msgId", "")

    async def get_message(self, qmgr: str, queue: str,
                           correlation_id: Optional[str] = None,
                           wait_interval_ms: int = 500) -> Optional[str]:
        headers = self._csrf_headers()
        headers["ibm-mq-rest-msgId"] = "any"
        if correlation_id:
            headers["ibm-mq-md-correlId"] = correlation_id
        params = {"wait": wait_interval_ms}
        r = await self.client.delete(
            f"{self.base_url}/ibmmq/rest/v1/messaging/qmgr/{qmgr}"
            f"/queue/{queue}/message",
            auth=self.auth,
            headers=headers,
            params=params
        )
        if r.status_code == 204:
            return None  # No message
        if not r.is_success:
            raise self._map_mq_error(r, "GET_MESSAGE")
        return r.text

    async def get_queue_depth(self, qmgr: str, queue: str) -> int:
        """Return current queue depth."""
        q = await self.get_queue(qmgr, queue, include_status=True)
        if q is None:
            return -1
        return q.get("status", {}).get("currentDepth", 0)

    async def get_channel_status(self, qmgr: str,
                                  channel: str) -> str:
        r = await self.client.get(
            f"{self.base_url}/ibmmq/rest/v2/admin/qmgr/{qmgr}"
            f"/channel/{channel}",
            auth=self.auth,
            params={"status": "status"}
        )
        if r.status_code == 404:
            return "NOT_FOUND"
        if not r.is_success:
            return "ERROR"
        channels = r.json().get("channel", [])
        if not channels:
            return "NOT_FOUND"
        return channels[0].get("status", {}).get("status", "UNKNOWN")
```

---

## Queue Monitoring Subsystem

```python
# bcl/mq/monitor.py
"""
Background task that polls all QMs every 30s and writes metrics to Prometheus.
Also detects stuck messages (queue depth non-zero for > 2 poll cycles).
"""
import asyncio
import structlog
from prometheus_client import Gauge, Counter
from mq.registry import get_registry

log = structlog.get_logger()

QUEUE_DEPTH = Gauge(
    "mq_queue_depth",
    "Current queue depth",
    ["qm_name", "queue_name"]
)
CHANNEL_STATUS = Gauge(
    "mq_channel_running",
    "1 if channel is RUNNING, 0 otherwise",
    ["qm_name", "channel_name"]
)
QM_CONNECTED = Gauge(
    "mq_qm_connected",
    "1 if QM is reachable, 0 otherwise",
    ["qm_name"]
)
STUCK_MESSAGES = Counter(
    "mq_stuck_messages_total",
    "Count of stuck message detections",
    ["qm_name", "queue_name"]
)

_prev_depths: dict = {}

async def monitor_loop():
    """Run forever, polling MQ fleet every 30 seconds."""
    while True:
        await _poll_all()
        await asyncio.sleep(30)

async def _poll_all():
    registry = get_registry()
    for qm_entry in registry.list_qms():
        try:
            # QM connectivity
            await qm_entry.client.get_qmgr_status()
            QM_CONNECTED.labels(qm_entry.name).set(1)

            # Queue depths
            queues = await qm_entry.client.list_queues(qm_entry.internal_name)
            for q in queues:
                name = q.get("name", "")
                depth = q.get("status", {}).get("currentDepth", 0)
                QUEUE_DEPTH.labels(qm_entry.name, name).set(depth)

                # Stuck message detection
                key = f"{qm_entry.name}:{name}"
                if depth > 0 and _prev_depths.get(key, 0) > 0:
                    STUCK_MESSAGES.labels(qm_entry.name, name).inc()
                    log.warning("stuck_messages_detected",
                                qm=qm_entry.name, queue=name, depth=depth)
                _prev_depths[key] = depth

            # Channel statuses
            channels = await qm_entry.client.list_channels(
                qm_entry.internal_name
            )
            for ch in channels:
                ch_name = ch.get("name", "")
                status = ch.get("status", {}).get("status", "UNKNOWN")
                CHANNEL_STATUS.labels(qm_entry.name, ch_name).set(
                    1 if status == "RUNNING" else 0
                )

        except Exception as e:
            QM_CONNECTED.labels(qm_entry.name).set(0)
            log.error("qm_poll_failed", qm=qm_entry.name, error=str(e))
```

Start the monitor in BCL `main.py`:

```python
# bcl/main.py startup event
@app.on_event("startup")
async def startup():
    from mq.registry import bootstrap_registry
    from mq.monitor import monitor_loop
    bootstrap_registry()
    asyncio.create_task(monitor_loop())
```

---

## Queue Management Router

```python
# bcl/routers/queues.py
from fastapi import APIRouter, Query
from pydantic import BaseModel
from mq.registry import get_registry
from policy.engine import enforce_pre_operation
from state.redis_store import RedisStore
from typing import Optional

router = APIRouter(tags=["queues"])

class CreateQueueRequest(BaseModel):
    qm: str
    name: str
    type: str = "LOCAL"
    description: Optional[str] = None
    max_depth: Optional[int] = None

@router.post("/queues")
async def create_queue(req: CreateQueueRequest):
    await enforce_pre_operation(
        {"type": "create_queue", "object_type": "queue",
         "name": req.name},
        req.qm
    )
    registry = get_registry()
    qm = registry.get(req.qm)
    props = {"type": req.type}
    if req.description:
        props["description"] = req.description
    if req.max_depth:
        props["maxDepth"] = req.max_depth

    result = await qm.client.create_queue(qm.internal_name, req.name, props)

    store = RedisStore()
    await store.append_audit({
        "operation": "CREATE_QUEUE",
        "qm_target": req.qm,
        "object": req.name,
        "result": "SUCCESS",
    })

    return {"queue": req.name, "qm": req.qm, "status": "created"}

@router.get("/queues")
async def list_queues(qm: str = Query(...)):
    registry = get_registry()
    qm_entry = registry.get(qm)
    queues = await qm_entry.client.list_queues(qm_entry.internal_name)
    return {"qm": qm, "queues": queues}

@router.delete("/queues/{queue_name}")
async def delete_queue(queue_name: str, qm: str = Query(...)):
    registry = get_registry()
    qm_entry = registry.get(qm)
    await qm_entry.client.delete_queue(qm_entry.internal_name, queue_name)
    return {"queue": queue_name, "qm": qm, "status": "deleted"}

@router.get("/queues/{queue_name}/depth")
async def get_queue_depth(queue_name: str, qm: str = Query(...)):
    registry = get_registry()
    qm_entry = registry.get(qm)
    depth = await qm_entry.client.get_queue_depth(
        qm_entry.internal_name, queue_name
    )
    return {"queue": queue_name, "qm": qm, "depth": depth}
```

---

## Success Criteria

| Criterion | Verification |
|-----------|-------------|
| All CRUD operations work against live MQ pods | Integration test against real MQ container |
| Retry logic handles transient errors | Kill MQ pod briefly — client reconnects |
| Queue depth metrics in Prometheus | Grafana queue depth panel shows values |
| Channel status metrics tracked | Grafana channel panel shows RUNNING/STOPPED |
| Stuck message detection fires | Force a queue with messages, wait 2 poll cycles |
| Error responses properly structured | Bad request returns MQError with detail |
| DLQ enforcement via policy engine | CREATE_QUEUE rejected when DLQ absent |
