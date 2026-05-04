"""
OCP pod deployer for IBM MQ queue managers.
Deploys a new MQ QM pod (Deployment + Service) to OCP and waits for readiness.
"""
import asyncio
import os

import httpx
import structlog

log = structlog.get_logger()

OCP_API = os.environ.get("OCP_API_URL", "https://kubernetes.default.svc")
OCP_TOKEN_PATH = "/var/run/secrets/kubernetes.io/serviceaccount/token"
NAMESPACE = os.environ.get("OCP_NAMESPACE", "mq-hackathon")


def _get_token() -> str:
    with open(OCP_TOKEN_PATH) as f:
        return f.read().strip()


def _ocp_headers() -> dict:
    return {
        "Authorization": f"Bearer {_get_token()}",
        "Content-Type": "application/json",
    }


async def deploy_qm_pod(qm_logical_name: str, zone: str, app_id: str) -> None:
    """Deploy a new MQ queue manager pod on OCP and wait for it to be ready."""
    pod_name = qm_logical_name.lower().replace(".", "-")
    internal_name = qm_logical_name.replace(".", "")[:48]

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
            },
        },
        "spec": {
            "replicas": 1,
            "selector": {"matchLabels": {"app": pod_name}},
            "template": {
                "metadata": {"labels": {"app": pod_name}},
                "spec": {
                    "containers": [
                        {
                            "name": "qm",
                            "image": "ibm-messaging/mq-container:latest",
                            "env": [
                                {"name": "MQ_QMGR_NAME", "value": internal_name},
                                {"name": "LICENSE", "value": "accept"},
                                {
                                    "name": "MQ_ADMIN_PASSWORD",
                                    "valueFrom": {
                                        "secretKeyRef": {
                                            "name": "mq-admin-creds",
                                            "key": "password",
                                        }
                                    },
                                },
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
                                    "port": 9443,
                                    "scheme": "HTTPS",
                                },
                                "initialDelaySeconds": 60,
                                "periodSeconds": 30,
                            },
                            "readinessProbe": {
                                "httpGet": {
                                    "path": "/ibmmq/rest/v2/admin/qmgr",
                                    "port": 9443,
                                    "scheme": "HTTPS",
                                },
                                "initialDelaySeconds": 30,
                                "periodSeconds": 10,
                            },
                        }
                    ]
                },
            },
        },
    }

    svc = {
        "apiVersion": "v1",
        "kind": "Service",
        "metadata": {"name": f"{pod_name}-svc", "namespace": NAMESPACE},
        "spec": {
            "selector": {"app": pod_name},
            "ports": [
                {"name": "mq", "port": 1414},
                {"name": "rest-admin", "port": 9443},
            ],
        },
    }

    headers = _ocp_headers()
    async with httpx.AsyncClient(verify=False) as client:
        r = await client.post(
            f"{OCP_API}/apis/apps/v1/namespaces/{NAMESPACE}/deployments",
            json=deployment,
            headers=headers,
        )
        if r.status_code not in (200, 201, 409):
            r.raise_for_status()

        r = await client.post(
            f"{OCP_API}/api/v1/namespaces/{NAMESPACE}/services",
            json=svc,
            headers=headers,
        )
        if r.status_code not in (200, 201, 409):
            r.raise_for_status()

    await _wait_for_qm_ready(pod_name)
    log.info("qm_pod_deployed", qm=qm_logical_name, pod=pod_name)


async def _wait_for_qm_ready(pod_name: str, timeout: int = 120) -> None:
    """Poll the QM REST admin endpoint until it returns 200 or timeout expires."""
    svc_url = f"https://{pod_name}-svc:9443"
    admin_pw = os.environ.get("MQ_ADMIN_PASSWORD", "passw0rd")
    deadline = asyncio.get_event_loop().time() + timeout

    async with httpx.AsyncClient(verify=False, timeout=5) as client:
        while asyncio.get_event_loop().time() < deadline:
            try:
                r = await client.get(
                    f"{svc_url}/ibmmq/rest/v2/admin/qmgr",
                    auth=("admin", admin_pw),
                )
                if r.status_code == 200:
                    return
            except Exception:
                pass
            await asyncio.sleep(5)

    raise TimeoutError(f"QM pod {pod_name} not ready after {timeout}s")
