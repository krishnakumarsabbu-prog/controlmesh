# Phase 6: Assessment / Provisioning Agent Implementation

**Duration:** 2–3 days
**Objective:** Build the Provisioning Agent — the specialist responsible for creating all MQ objects (queue managers, queues, channels, DLQs, listeners) on the target topology.

---

## Context and Rationale

The Provisioning Agent is the first specialist the Orchestrator calls. Before any rewiring can happen, the target queue manager must exist with its full object set: DLQ, application queues, sender/receiver channels, and listeners.

A key constraint: **DLQ must be created before any other queue on the QM**. The provisioning agent knows this ordering rule and enforces it through its tool call sequence, regardless of what order the orchestrator requests things.

The agent also handles OCP pod deployment — it calls the OCP API to spin up a new MQ pod for the target QM, waits for it to become ready, then populates it with MQ objects.

---

## Provisioning Agent

### 6.1 Agent Definition

```python
# agents/provisioning.py
from google.adk.agents import Agent
from .base import GEMINI_MODEL
from .tools.mq_tools import (
    create_queue_manager,
    create_queue,
    set_dlq,
    create_channel,
    create_listener,
)
from .tools.audit_tools import log_audit_event

PROVISIONING_INSTRUCTION = """
You are the IBM MQ Provisioning Agent. Your job is to create all MQ objects
needed for a new target queue manager on OCP.

## Tools available
- create_queue_manager(qm_logical_name, zone, app_id)
- create_queue(qm_name, queue_name, queue_type, props)
- set_dlq(qm_name, dlq_name)
- create_channel(qm_name, channel_name, channel_type, props)
- create_listener(qm_name, listener_name, port)
- log_audit_event(operation, qm_target, agent, result)

## MANDATORY ordering rule
1. create_queue_manager FIRST
2. set_dlq IMMEDIATELY after QM creation (before any other queues)
3. create application queues
4. create channels (with sslCipherSpec always set)
5. create listener

## Naming conventions (STRICTLY enforced by BCL policy)
- QM: QM.<APP> e.g. QM.APP1
- Queues: Q.<APP>.<PURPOSE>.LOCAL e.g. Q.APP1.REQUEST.LOCAL
- DLQ: Q.<APP>.DLQ.LOCAL
- Channels: CHL.<SRC>.<TGT> e.g. CHL.SRCA.APP1
- Listeners: LST.<APP>.<PORT> e.g. LST.APP1.1414

## Security requirements
- All channels MUST have sslCipherSpec set (e.g. "TLS_RSA_WITH_AES_256_CBC_SHA256")
- All channels MUST have mcaUser set for MCA authorization
- Cross-zone channels MUST be type SVRCONN

## Response format
Return JSON:
{
  "status": "PROVISIONED" | "FAILED",
  "qm_created": "<name>",
  "objects_created": ["<list of created objects>"],
  "error": null | "<description>"
}
"""

def build_provisioning_agent() -> Agent:
    return Agent(
        name="provisioning_agent",
        model=GEMINI_MODEL,
        instruction=PROVISIONING_INSTRUCTION,
        tools=[
            create_queue_manager,
            create_queue,
            set_dlq,
            create_channel,
            create_listener,
            log_audit_event,
        ],
    )
```

---

### 6.2 Additional Tools

```python
# agents/tools/mq_tools.py (additional provisioning tools)

async def create_listener(qm_name: str, listener_name: str, port: int) -> dict:
    """Create a listener on the specified QM."""
    from policy.naming import validate_naming
    from mq.registry import get_registry

    errors = validate_naming({
        "object_type": "listener",
        "name": listener_name
    })
    if errors:
        return {"status": "error", "violations": errors}

    registry = get_registry()
    qm = registry.get(qm_name)
    r = await qm.client.client.post(
        f"{qm.svc_url}/ibmmq/rest/v2/admin/qmgr/{qm.internal_name}/listener",
        json={
            "name": listener_name,
            "port": port,
            "transport": "TCP",
        },
        auth=qm.client.auth,
        headers={"ibm-mq-rest-csrf-token": "blank"}
    )
    r.raise_for_status()
    return {"status": "created", "listener": listener_name,
            "port": port, "qm": qm_name}
```

---

### 6.3 OCP Pod Deployer

```python
# ocp/deployer.py
import asyncio
import httpx
import os
import structlog

log = structlog.get_logger()

OCP_API = os.environ.get("OCP_API_URL", "https://kubernetes.default.svc")
OCP_TOKEN_PATH = "/var/run/secrets/kubernetes.io/serviceaccount/token"
NAMESPACE = os.environ.get("OCP_NAMESPACE", "mq-hackathon")

def _get_token() -> str:
    with open(OCP_TOKEN_PATH) as f:
        return f.read().strip()

async def deploy_qm_pod(qm_logical_name: str, zone: str, app_id: str):
    """Deploy a new MQ queue manager pod on OCP."""
    pod_name = qm_logical_name.lower().replace(".", "-")
    internal_name = qm_logical_name.replace(".", "")[:48]
    admin_pw = os.environ["MQ_ADMIN_PASSWORD"]

    deployment = {
        "apiVersion": "apps/v1",
        "kind": "Deployment",
        "metadata": {
            "name": pod_name,
            "namespace": NAMESPACE,
            "labels": {
                "app": "mq-fleet",
                "qm-role": "target",
                "qm-name": qm_logical_name,
                "app-id": app_id,
            }
        },
        "spec": {
            "replicas": 1,
            "selector": {"matchLabels": {"app": pod_name}},
            "template": {
                "metadata": {"labels": {"app": pod_name}},
                "spec": {
                    "containers": [{
                        "name": "qm",
                        "image": "ibm-messaging/mq-container:latest",
                        "env": [
                            {"name": "MQ_QMGR_NAME", "value": internal_name},
                            {"name": "LICENSE", "value": "accept"},
                            {"name": "MQ_ADMIN_PASSWORD",
                             "valueFrom": {"secretKeyRef": {
                                 "name": "mq-admin-creds", "key": "password"
                             }}}
                        ],
                        "ports": [
                            {"containerPort": 1414, "name": "mq"},
                            {"containerPort": 9443, "name": "rest-admin"},
                        ],
                        "resources": {
                            "requests": {"cpu": "200m", "memory": "512Mi"}
                        },
                        "livenessProbe": {
                            "httpGet": {
                                "path": "/ibmmq/rest/v2/admin/qmgr",
                                "port": 9443, "scheme": "HTTPS"
                            },
                            "initialDelaySeconds": 60,
                            "periodSeconds": 30,
                        },
                        "readinessProbe": {
                            "httpGet": {
                                "path": "/ibmmq/rest/v2/admin/qmgr",
                                "port": 9443, "scheme": "HTTPS"
                            },
                            "initialDelaySeconds": 30,
                            "periodSeconds": 10,
                        },
                    }]
                }
            }
        }
    }

    svc = {
        "apiVersion": "v1",
        "kind": "Service",
        "metadata": {
            "name": f"{pod_name}-svc",
            "namespace": NAMESPACE,
        },
        "spec": {
            "selector": {"app": pod_name},
            "ports": [
                {"name": "mq", "port": 1414},
                {"name": "rest-admin", "port": 9443},
            ]
        }
    }

    headers = {
        "Authorization": f"Bearer {_get_token()}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(verify=False) as client:
        # Create Deployment
        r = await client.post(
            f"{OCP_API}/apis/apps/v1/namespaces/{NAMESPACE}/deployments",
            json=deployment, headers=headers
        )
        if r.status_code not in (200, 201, 409):  # 409 = already exists
            r.raise_for_status()

        # Create Service
        r = await client.post(
            f"{OCP_API}/api/v1/namespaces/{NAMESPACE}/services",
            json=svc, headers=headers
        )
        if r.status_code not in (200, 201, 409):
            r.raise_for_status()

    # Wait for pod to be ready
    await _wait_for_qm_ready(pod_name, timeout=120)
    log.info("qm_pod_deployed", qm=qm_logical_name, pod=pod_name)

async def _wait_for_qm_ready(pod_name: str, timeout: int = 120):
    """Poll OCP until the QM pod is ready."""
    svc_url = f"https://{pod_name}-svc:9443"
    deadline = asyncio.get_event_loop().time() + timeout
    admin_pw = os.environ["MQ_ADMIN_PASSWORD"]

    async with httpx.AsyncClient(verify=False, timeout=5) as client:
        while asyncio.get_event_loop().time() < deadline:
            try:
                r = await client.get(
                    f"{svc_url}/ibmmq/rest/v2/admin/qmgr",
                    auth=("admin", admin_pw)
                )
                if r.status_code == 200:
                    return
            except Exception:
                pass
            await asyncio.sleep(5)

    raise TimeoutError(f"QM pod {pod_name} not ready after {timeout}s")
```

---

## Source Topology — Six Applications

The source topology has **6 applications** spread across 2 shared QMs:

```
QM.SRC.A (shared by APP1, APP2, APP3)
├── Q.APP1.REQUEST.LOCAL
├── Q.APP1.RESPONSE.LOCAL
├── Q.APP2.REQUEST.LOCAL
├── Q.APP2.RESPONSE.LOCAL
├── Q.APP3.REQUEST.LOCAL
├── Q.APP3.RESPONSE.LOCAL
└── Q.SRCA.DLQ.LOCAL

QM.SRC.B (shared by APP4, APP5, APP6)
├── Q.APP4.REQUEST.LOCAL
├── Q.APP4.RESPONSE.LOCAL
├── Q.APP5.REQUEST.LOCAL
├── Q.APP5.RESPONSE.LOCAL
├── Q.APP6.REQUEST.LOCAL
├── Q.APP6.RESPONSE.LOCAL
└── Q.SRCB.DLQ.LOCAL
```

The provisioning agent creates this topology via the BCL. Evidence script:

```python
# scripts/provision_source_topology.py
"""
Evidence script: provisions the full source topology via BCL API.
Run once at the start of the hackathon demo.
"""
import httpx, json

BCL_URL = "http://bcl-gateway-svc:8000/api"

source_topology = {
    "QM.SRC.A": {
        "apps": ["APP1", "APP2", "APP3"],
        "queues": [
            "Q.APP1.REQUEST.LOCAL", "Q.APP1.RESPONSE.LOCAL",
            "Q.APP2.REQUEST.LOCAL", "Q.APP2.RESPONSE.LOCAL",
            "Q.APP3.REQUEST.LOCAL", "Q.APP3.RESPONSE.LOCAL",
            "Q.SRCA.DLQ.LOCAL",
        ],
    },
    "QM.SRC.B": {
        "apps": ["APP4", "APP5", "APP6"],
        "queues": [
            "Q.APP4.REQUEST.LOCAL", "Q.APP4.RESPONSE.LOCAL",
            "Q.APP5.REQUEST.LOCAL", "Q.APP5.RESPONSE.LOCAL",
            "Q.APP6.REQUEST.LOCAL", "Q.APP6.RESPONSE.LOCAL",
            "Q.SRCB.DLQ.LOCAL",
        ],
    },
}

def provision():
    with httpx.Client() as client:
        for qm_name, config in source_topology.items():
            # DLQ first
            dlq = [q for q in config["queues"] if "DLQ" in q][0]
            r = client.post(f"{BCL_URL}/queues",
                            json={"qm": qm_name, "name": dlq,
                                  "type": "LOCAL"})
            assert r.status_code == 200, f"DLQ failed: {r.text}"

            # Then app queues
            for q in config["queues"]:
                if "DLQ" not in q:
                    r = client.post(f"{BCL_URL}/queues",
                                    json={"qm": qm_name, "name": q,
                                          "type": "LOCAL"})
                    assert r.status_code == 200, f"Queue failed: {r.text}"
            print(f"Provisioned {qm_name}")

if __name__ == "__main__":
    provision()
```

---

## Success Criteria

| Criterion | Verification |
|-----------|-------------|
| Provisioning agent creates QM pod on OCP | `oc get pods -n mq-hackathon -l qm-role=target` |
| DLQ created before any other queue | Audit log shows DLQ as first object |
| All 6 source app queues provisioned | `GET /api/queues?qm=QM.SRC.A` returns 7 queues |
| TLS enforced on all channels | Policy engine rejects channels without sslCipherSpec |
| MCA user set on all channels | Policy engine rejects channels without mcaUser |
| Provisioning via BCL only | No direct MQ REST calls outside BCL in evidence logs |
