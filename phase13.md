# Phase 13: Production Hardening and Optimization

**Duration:** 2–3 days
**Objective:** Harden the system for the hackathon demo environment: production-grade security, performance tuning, backup/recovery procedures, operational runbooks, and monitoring alert rules.

---

## Context and Rationale

The hackathon evaluation requires "production-quality engineering." Phase 13 turns the working system into an operable one. A working demo that crashes under load or has obvious security gaps will lose points. Phase 13 addresses:

- Security hardening (secrets management, network policies, TLS everywhere)
- Performance optimization (BCL concurrency, Redis connection pooling)
- Operational runbooks (how to restart, how to recover)
- Alert rules (Prometheus alert definitions)
- Disaster recovery (Redis backup, QM state recovery)

---

## Security Hardening

### 13.1 Secret Rotation

```yaml
# ocp/secrets/sealed-secrets.yaml
# Use Bitnami Sealed Secrets for GitOps-safe secrets
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: mq-admin-creds
  namespace: mq-hackathon
spec:
  encryptedData:
    password: <sealed-value>
```

All secrets referenced via `secretKeyRef` — no plaintext in Deployments.

```bash
# Rotate MQ admin password (runbook)
oc create secret generic mq-admin-creds \
  --from-literal=password='<new-password>' \
  --dry-run=client -o yaml | oc apply -f -
# Rolling restart BCL pods to pick up new secret
oc rollout restart deployment/bcl-gateway -n mq-hackathon
```

---

### 13.2 Network Policies (Hardened)

```yaml
# ocp/network-policy/hardened.yaml
# BCL can reach MQ pods on ports 9443 and 1414
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: bcl-to-mq
  namespace: mq-hackathon
spec:
  podSelector:
    matchLabels:
      app: mq-fleet
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: bcl-gateway
    ports:
    - port: 9443
    - port: 1414
---
# UI can reach BCL on 8000
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ui-to-bcl
  namespace: mq-hackathon
spec:
  podSelector:
    matchLabels:
      app: bcl-gateway
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: mq-ui
    ports:
    - port: 8000
---
# Redis accessible only by BCL
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: bcl-to-redis
  namespace: mq-hackathon
spec:
  podSelector:
    matchLabels:
      app: redis
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: bcl-gateway
    ports:
    - port: 6379
```

---

### 13.3 TLS for BCL Gateway

```yaml
# ocp/bcl/bcl-route.yaml
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: bcl-route
  namespace: mq-hackathon
spec:
  to:
    kind: Service
    name: bcl-gateway-svc
  port:
    targetPort: 8000
  tls:
    termination: edge
    insecureEdgeTerminationPolicy: Redirect
```

---

## Performance Optimization

### 13.4 BCL Concurrency Tuning

```python
# bcl/main.py — Uvicorn config
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        workers=2,          # 2 workers per pod (200m CPU limit)
        loop="uvloop",      # Faster event loop
        http="httptools",   # Faster HTTP parser
        access_log=False,   # Structured logging handles this
    )
```

```python
# bcl/state/redis_store.py — Connection pool
import aioredis

_pool = None

async def get_redis_pool():
    global _pool
    if _pool is None:
        _pool = await aioredis.from_url(
            os.environ["REDIS_URL"],
            max_connections=20,
            decode_responses=True,
        )
    return _pool
```

---

### 13.5 MQ Client Connection Reuse

```python
# bcl/mq/client.py — Singleton httpx client per QM entry
# (already in Phase 10 — confirm it is using connection pooling)
# Verify: httpx.Limits(max_connections=20, max_keepalive_connections=10)
```

---

### 13.6 BCL Response Caching

```python
# bcl/routers/fleet.py — Cache fleet list for 10s
from fastapi_cache.decorator import cache

@router.get("/fleet")
@cache(expire=10)
async def list_fleet():
    ...
```

---

## Prometheus Alert Rules

```yaml
# ocp/monitoring/alert-rules.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: mq-migration-alerts
  namespace: mq-hackathon
spec:
  groups:
  - name: mq-migration
    rules:
    - alert: QMNotReachable
      expr: mq_qm_connected == 0
      for: 2m
      labels:
        severity: critical
      annotations:
        summary: "QM {{ $labels.qm_name }} unreachable for 2 minutes"

    - alert: MigrationStuck
      expr: |
        time() - migration_last_transition_timestamp > 600
        and migration_state != "MIGRATED"
        and migration_state != "ROLLED_BACK"
        and migration_state != "IDLE"
      for: 0m
      labels:
        severity: warning
      annotations:
        summary: "Migration for {{ $labels.app_id }} stuck for >10 minutes"

    - alert: BCLHighLatency
      expr: histogram_quantile(0.99, rate(request_latency_seconds_bucket[5m])) > 1
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "BCL p99 latency above 1s"

    - alert: StuckMessages
      expr: increase(mq_stuck_messages_total[5m]) > 0
      for: 0m
      labels:
        severity: warning
      annotations:
        summary: "Stuck messages detected on {{ $labels.qm_name }}/{{ $labels.queue_name }}"

    - alert: ValidationFailureRate
      expr: |
        rate(validation_failures_total[10m]) > 0.1
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "High validation failure rate — check MQ flows"
```

---

## Disaster Recovery

### 13.7 Redis Backup

```bash
# Scheduled Redis backup (runs as CronJob on OCP)
# Saves RDB snapshot to PVC / object storage
apiVersion: batch/v1
kind: CronJob
metadata:
  name: redis-backup
  namespace: mq-hackathon
spec:
  schedule: "*/30 * * * *"  # Every 30 minutes
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: redis:7-alpine
            command:
            - sh
            - -c
            - redis-cli -h redis-svc -a $REDIS_PASSWORD --rdb /backup/redis-$(date +%Y%m%d-%H%M).rdb
            env:
            - name: REDIS_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: redis-creds
                  key: password
            volumeMounts:
            - name: backup-storage
              mountPath: /backup
          restartPolicy: OnFailure
          volumes:
          - name: backup-storage
            persistentVolumeClaim:
              claimName: redis-backup-pvc
```

### 13.8 QM State Recovery Runbook

```markdown
# Runbook: Recover from QM Pod Loss

## Symptoms
- `mq_qm_connected{qm_name="QM.APP1"} == 0` for > 2 minutes
- `/healthz/ready` returns 503
- Migrations stuck in PROVISIONING_TARGET or REWIRING

## Steps

### 1. Check pod status
oc get pods -n mq-hackathon -l qm-name=QM.APP1

### 2. If pod is CrashLoopBackOff
oc logs -n mq-hackathon <pod-name> --previous
oc describe pod -n mq-hackathon <pod-name>

### 3. Force pod restart
oc rollout restart deployment/qm-app1 -n mq-hackathon

### 4. If pod won't start (image pull / resource issue)
# Check quota
oc describe quota -n mq-hackathon
# Check image
oc get events -n mq-hackathon --sort-by='.lastTimestamp' | tail -20

### 5. After pod recovers
# Trigger rollback for any stuck migrations
curl -X POST http://bcl-gateway-svc:8000/api/migration/APP1/rollback

### 6. Verify source topology restored
curl http://bcl-gateway-svc:8000/api/queues?qm=QM.SRC.A

### 7. Re-attempt migration
curl -X POST http://bcl-gateway-svc:8000/api/migration/execute \
  -H 'Content-Type: application/json' \
  -d '{"app_id":"APP1","source_qm":"QM.SRC.A","target_qm":"QM.APP1"}'
```

---

## Pre-Demo Checklist

Run this checklist 30 minutes before the hackathon demo:

```bash
#!/bin/bash
# scripts/pre-demo-checklist.sh
set -e

echo "=== 1. All pods running ==="
oc get pods -n mq-hackathon

echo "=== 2. BCL health ==="
curl -sf http://bcl-gateway-svc:8000/healthz/ready && echo "BCL: READY"

echo "=== 3. Source QMs reachable ==="
curl -sf http://bcl-gateway-svc:8000/api/fleet | jq '.queue_managers[].name'

echo "=== 4. Source topology provisioned ==="
curl -sf "http://bcl-gateway-svc:8000/api/queues?qm=QM.SRC.A" | \
  jq '[.queues[].name]'

echo "=== 5. All apps in IDLE state ==="
curl -sf http://bcl-gateway-svc:8000/api/migration/status | \
  jq '[.migrations[] | {app_id, state}]'

echo "=== 6. Baseline validation passes ==="
for app in APP1 APP2 APP3; do
  result=$(curl -sf -X POST http://bcl-gateway-svc:8000/api/validate \
    -H 'Content-Type: application/json' \
    -d "{\"app_id\":\"$app\",\"qm_name\":\"QM.SRC.A\",\"queue_name\":\"Q.${app}.REQUEST.LOCAL\",\"phase\":\"BASELINE\"}")
  passed=$(echo $result | jq '.passed')
  echo "$app baseline: $passed"
done

echo "=== 7. Redis reachable ==="
oc exec -n mq-hackathon deployment/redis -- \
  redis-cli -a $REDIS_PASSWORD ping

echo "=== 8. UI accessible ==="
curl -sf $(oc get route mq-ui-route -n mq-hackathon -o jsonpath='{.spec.host}') \
  -o /dev/null && echo "UI: OK"

echo "=== PRE-DEMO CHECKS PASSED ==="
```

---

## Success Criteria

| Criterion | Verification |
|-----------|-------------|
| All secrets managed via OCP secrets | No plaintext credentials in manifests |
| Network policies enforced | External pod cannot reach Redis directly |
| BCL TLS route active | Browser shows HTTPS padlock |
| Prometheus alerts configured | Alert rules visible in OCP monitoring |
| Redis backup running | CronJob shows recent completions |
| Pre-demo checklist passes | `./scripts/pre-demo-checklist.sh` exits 0 |
| Runbooks documented | `docs/runbooks/` populated |
| BCL p99 latency < 500ms | Locust report at 100 concurrent users |
