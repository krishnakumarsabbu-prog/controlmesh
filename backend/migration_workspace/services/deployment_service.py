"""Mock deployment service — simulates OCP deployment sequences."""

import asyncio
import time
from typing import AsyncGenerator

DEPLOY_SEQUENCES = {
    "blue-green": [
        ("HEAD", "━━━  BLUE/GREEN DEPLOYMENT INITIATED  ━━━"),
        ("CMD",  "$ oc get deployment payment-api -n mq-prod"),
        ("INFO", "deployment.apps/payment-api   1/1   1   1   18m"),
        ("CMD",  "$ oc scale deployment/payment-api-green --replicas=2"),
        ("INFO", "Scaling GREEN environment → 2 replicas"),
        ("INFO", "Waiting for rollout... (0/2 pods ready)"),
        ("INFO", "Waiting for rollout... (1/2 pods ready)"),
        ("OK",   "GREEN environment healthy: 2/2 pods running"),
        ("CMD",  "$ oc apply -f runtime-config-cloud.yaml"),
        ("INFO", "configmap/payment-api-runtime-config updated"),
        ("INFO", "Injecting MQ settings → CLOUD.PAY.QM1:1414"),
        ("INFO", "TLS cipher: TLS_AES_256_GCM_SHA384 ✓"),
        ("INFO", "CCDT updated → cloud.pay.qm1.mq.ibm.com"),
        ("CMD",  "$ oc rollout status deployment/payment-api-green"),
        ("INFO", "Waiting for rollout to finish: 0 of 2 updated replicas available..."),
        ("INFO", "Waiting for rollout to finish: 1 of 2 updated replicas available..."),
        ("OK",   "Rollout complete. 2/2 replicas available"),
        ("CMD",  "$ oc set route payment-api --to=payment-api-green"),
        ("INFO", "Traffic switching BLUE → GREEN"),
        ("INFO", "Running readiness probe on /health/mq..."),
        ("INFO", "Probe attempt 1/3 → HTTP 200 OK (latency: 42ms)"),
        ("OK",   "Readiness probe passed ✓"),
        ("CMD",  "$ oc scale deployment/payment-api-blue --replicas=0"),
        ("INFO", "Draining BLUE environment"),
        ("OK",   "━━━  BLUE/GREEN DEPLOYMENT SUCCESSFUL  ━━━"),
    ],
    "rolling": [
        ("HEAD", "━━━  ROLLING DEPLOYMENT INITIATED  ━━━"),
        ("CMD",  "$ oc rollout restart deployment/payment-api"),
        ("INFO", "deployment.apps/payment-api restarted"),
        ("INFO", "Rolling update: pod payment-api-78b9d4c5-xq7k2 terminating"),
        ("INFO", "Pulling image: registry.redhat.io/payment-api:v2.4.1"),
        ("INFO", "Container runtime-config updated → CLOUD.PAY.QM1"),
        ("INFO", "Pod payment-api-78b9d4c5-xq7k2 starting..."),
        ("INFO", "Running readiness probe /health/mq → 200 OK"),
        ("OK",   "Pod payment-api-78b9d4c5-xq7k2 running (1/2 updated)"),
        ("INFO", "Rolling update: pod payment-api-78b9d4c5-r2p9m terminating"),
        ("INFO", "Container runtime-config updated → CLOUD.PAY.QM1"),
        ("INFO", "Pod payment-api-78b9d4c5-r2p9m starting..."),
        ("INFO", "Running readiness probe /health/mq → 200 OK"),
        ("OK",   "Pod payment-api-78b9d4c5-r2p9m running (2/2 updated)"),
        ("OK",   "━━━  ROLLING DEPLOYMENT SUCCESSFUL  ━━━"),
    ],
    "canary": [
        ("HEAD", "━━━  CANARY DEPLOYMENT INITIATED  ━━━"),
        ("INFO", "Deploying canary: 10% traffic weight"),
        ("CMD",  "$ oc apply -f payment-api-canary.yaml"),
        ("INFO", "deployment.apps/payment-api-canary created"),
        ("INFO", "VirtualService updated: canary weight=10, stable weight=90"),
        ("INFO", "Canary pod payment-api-canary-5f7bc9-kl8tz starting..."),
        ("INFO", "Injecting runtime config → CLOUD.PAY.QM1"),
        ("OK",   "Canary pod healthy — routing 10% traffic"),
        ("INFO", "Monitoring canary metrics (60s observation window)..."),
        ("INFO", "Error rate: 0.00% ✓  |  Latency p99: 48ms ✓"),
        ("INFO", "Promoting canary: 50% traffic weight"),
        ("INFO", "VirtualService updated: canary weight=50, stable weight=50"),
        ("INFO", "Error rate: 0.00% ✓  |  Latency p99: 45ms ✓"),
        ("INFO", "Promoting canary: 100% traffic weight"),
        ("CMD",  "$ oc delete deployment payment-api-stable"),
        ("INFO", "Stable deployment decommissioned"),
        ("OK",   "━━━  CANARY DEPLOYMENT SUCCESSFUL  ━━━"),
    ],
    "immediate": [
        ("HEAD", "━━━  IMMEDIATE DEPLOYMENT INITIATED  ━━━"),
        ("WARN", "WARNING: Immediate deployment — no gradual rollout"),
        ("CMD",  "$ oc scale deployment/payment-api --replicas=0"),
        ("INFO", "Stopping all application pods..."),
        ("INFO", "All pods terminated"),
        ("CMD",  "$ oc apply -f runtime-config-cloud.yaml"),
        ("INFO", "Applying updated runtime configuration"),
        ("INFO", "configmap/payment-api-runtime-config replaced"),
        ("CMD",  "$ oc scale deployment/payment-api --replicas=2"),
        ("INFO", "Starting application pods with new config..."),
        ("INFO", "Pod payment-api-88c4d9-w7x2v starting..."),
        ("INFO", "Pod payment-api-88c4d9-p3q9n starting..."),
        ("INFO", "Running readiness probe /health/mq → 200 OK"),
        ("INFO", "Running readiness probe /health/mq → 200 OK"),
        ("OK",   "All pods running with updated MQ config"),
        ("OK",   "━━━  IMMEDIATE DEPLOYMENT SUCCESSFUL  ━━━"),
    ],
}


class DeploymentService:
    async def stream_deployment(
        self,
        strategy: str,
        config: dict,
    ) -> AsyncGenerator[dict, None]:
        sequence = DEPLOY_SEQUENCES.get(strategy, DEPLOY_SEQUENCES["blue-green"])

        for level, text in sequence:
            await asyncio.sleep(0.22 + (0.05 if level == "INFO" else 0))
            yield {
                "level": level,
                "text": text,
                "timestamp": time.time(),
            }

    async def run_deployment(self, strategy: str, config: dict) -> dict:
        """Run deployment and return a summary result (non-streaming)."""
        sequence = DEPLOY_SEQUENCES.get(strategy, DEPLOY_SEQUENCES["blue-green"])
        lines = []
        for level, text in sequence:
            lines.append({"level": level, "text": text, "timestamp": time.time()})
        return {
            "status": "success",
            "strategy": strategy,
            "lines": lines,
            "completed_at": time.time(),
        }
