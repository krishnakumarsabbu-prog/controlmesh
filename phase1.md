# Phase 1: Foundation Infrastructure Setup

**Duration:** 2–3 days
**Objective:** Establish the core OCP environment, IBM MQ fleet baseline, CI/CD pipeline, and observability stack that every subsequent phase depends on.

---

## Context and Rationale

Every layer of the solution — BCL gateway, ADK agent mesh, React UI — ultimately runs on OpenShift and talks to IBM MQ pods. Getting this foundation right in Phase 1 means all later phases can develop against a stable, observable, reproducible platform rather than fighting infrastructure surprises mid-sprint.

The architecture requires **8 MQ pods** (2 source QMs + 6 target QMs) each at 200 m CPU / 512 MiB memory — within the 10-pod quota. Infrastructure-as-code ensures the fleet is reproducible, auditable, and rollback-safe.

---

## Architecture Overview

```
OCP Cluster
├── Namespace: mq-hackathon
│   ├── MQ Fleet (Phase 1 baseline: 2 source pods)
│   │   ├── qm-src-a (QM.SRC.A)
│   │   └── qm-src-b (QM.SRC.B)
│   ├── Redis (state store for BCL)
│   ├── Prometheus + Grafana
│   └── Fluent Bit → Elasticsearch → Kibana
├── CI/CD: Tekton Pipeline / GitHub Actions → OCP
└── RBAC: dev / ops / readonly roles
```

---

## Deliverables

### 1.1 OpenShift Project and RBAC

Create namespace and service accounts:

```yaml
# ocp/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: mq-hackathon
  labels:
    app.kubernetes.io/part-of: mq-migration
---
# Service accounts
apiVersion: v1
kind: ServiceAccount
metadata:
  name: bcl-gateway
  namespace: mq-hackathon
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: mq-fleet-manager
  namespace: mq-hackathon
```

RBAC roles:

| Role | Permissions |
|------|-------------|
| `mq-dev` | get/list/watch pods, services; read secrets |
| `mq-ops` | full pod/service/deployment CRUD in namespace |
| `mq-readonly` | get/list only on all resources |

Apply:
```bash
oc apply -f ocp/namespace.yaml
oc apply -f ocp/rbac/
```

---

### 1.2 IBM MQ Fleet — Source Queue Managers

Deploy the `ibm-messaging/mq-container` image as two source QM pods. Phase 1 only provisions the **source** QMs; target QMs are created dynamically by the Provisioning Agent in Phase 8.

```yaml
# ocp/mq/qm-src-a.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: qm-src-a
  namespace: mq-hackathon
  labels:
    app: mq-fleet
    qm-role: source
    qm-name: QM.SRC.A
spec:
  replicas: 1
  selector:
    matchLabels:
      app: qm-src-a
  template:
    metadata:
      labels:
        app: qm-src-a
        qm-name: QM.SRC.A
    spec:
      serviceAccountName: mq-fleet-manager
      containers:
      - name: qm
        image: ibm-messaging/mq-container:latest
        env:
        - name: MQ_QMGR_NAME
          value: "QMSRCA"
        - name: LICENSE
          value: "accept"
        - name: MQ_ADMIN_PASSWORD
          valueFrom:
            secretKeyRef:
              name: mq-admin-creds
              key: password
        ports:
        - containerPort: 1414   # MQ listener
          name: mq
        - containerPort: 9443   # REST admin
          name: rest-admin
        resources:
          requests:
            cpu: 200m
            memory: 512Mi
          limits:
            cpu: 500m
            memory: 1Gi
        livenessProbe:
          httpGet:
            path: /ibmmq/rest/v2/admin/qmgr
            port: 9443
            scheme: HTTPS
          initialDelaySeconds: 60
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /ibmmq/rest/v2/admin/qmgr
            port: 9443
            scheme: HTTPS
          initialDelaySeconds: 30
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: qm-src-a-svc
  namespace: mq-hackathon
spec:
  selector:
    app: qm-src-a
  ports:
  - name: mq
    port: 1414
    targetPort: 1414
  - name: rest-admin
    port: 9443
    targetPort: 9443
```

Repeat the pattern for `qm-src-b` (QM.SRC.B).

**MQ Admin credentials secret:**
```bash
oc create secret generic mq-admin-creds \
  --from-literal=password='<strong-password>' \
  -n mq-hackathon
```

---

### 1.3 Redis State Store

Redis is the backbone for BCL topology snapshots and rollback checkpoints.

```yaml
# ocp/redis/redis.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: mq-hackathon
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        args: ["--requirepass", "$(REDIS_PASSWORD)"]
        env:
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: redis-creds
              key: password
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
---
apiVersion: v1
kind: Service
metadata:
  name: redis-svc
  namespace: mq-hackathon
spec:
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
```

---

### 1.4 Monitoring Stack

#### Prometheus

```yaml
# ocp/monitoring/prometheus-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: mq-hackathon
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
    scrape_configs:
    - job_name: 'bcl-gateway'
      static_configs:
      - targets: ['bcl-gateway-svc:8000']
      metrics_path: /metrics
    - job_name: 'mq-fleet'
      static_configs:
      - targets: ['qm-src-a-svc:9443', 'qm-src-b-svc:9443']
      scheme: https
      tls_config:
        insecure_skip_verify: true
```

#### Grafana Dashboards (pre-built panels)

| Dashboard | Key Metrics |
|-----------|-------------|
| MQ Fleet Overview | Queue depth, channel status, message rate |
| BCL Gateway | Request rate, p99 latency, policy violations |
| Migration Progress | State machine transitions per app |
| Agent Mesh | ADK tool call duration, success/failure rate |

#### ELK Stack (log aggregation)

```yaml
# Fluent Bit DaemonSet collects all pod stdout
# Logstash parses structured JSON logs from BCL
# Kibana index pattern: mq-hackathon-*
# Key saved searches:
#   - BCL policy violations
#   - Agent tool call failures
#   - MQ REST API errors
```

---

### 1.5 CI/CD Pipeline

```yaml
# .tekton/pipeline.yaml
apiVersion: tekton.dev/v1beta1
kind: Pipeline
metadata:
  name: mq-hackathon-pipeline
  namespace: mq-hackathon
spec:
  params:
  - name: git-revision
    type: string
  tasks:
  - name: lint
    taskRef:
      name: pylint-task
  - name: unit-test
    taskRef:
      name: pytest-task
    runAfter: [lint]
  - name: build-bcl
    taskRef:
      name: buildah-task
    runAfter: [unit-test]
  - name: build-ui
    taskRef:
      name: node-build-task
    runAfter: [unit-test]
  - name: deploy-staging
    taskRef:
      name: oc-apply-task
    runAfter: [build-bcl, build-ui]
  - name: integration-test
    taskRef:
      name: pytest-integration-task
    runAfter: [deploy-staging]
```

GitOps with Argo CD or OCP GitOps operator:
- `main` branch → staging auto-sync
- Tags (`v*`) → production promotion (manual gate)

---

### 1.6 Security Baseline

```bash
# Network policy: deny all ingress except within namespace
oc apply -f ocp/network-policy/deny-all.yaml
oc apply -f ocp/network-policy/allow-intra-namespace.yaml
oc apply -f ocp/network-policy/allow-bcl-to-mq.yaml

# Pod security: restricted SCC
oc adm policy add-scc-to-serviceaccount restricted \
  -z bcl-gateway -n mq-hackathon
```

TLS certificates for MQ REST Admin API:
```bash
# Generate self-signed for dev; use cert-manager in prod
openssl req -x509 -newkey rsa:4096 -keyout mq-tls.key \
  -out mq-tls.crt -days 365 -nodes \
  -subj "/CN=qm-src-a-svc.mq-hackathon.svc.cluster.local"
oc create secret tls mq-tls-secret \
  --cert=mq-tls.crt --key=mq-tls.key -n mq-hackathon
```

---

## Directory Structure

```
mq-hackathon/
├── ocp/
│   ├── namespace.yaml
│   ├── rbac/
│   │   ├── roles.yaml
│   │   └── bindings.yaml
│   ├── mq/
│   │   ├── qm-src-a.yaml
│   │   ├── qm-src-b.yaml
│   │   └── mq-secrets.yaml
│   ├── redis/
│   │   └── redis.yaml
│   ├── monitoring/
│   │   ├── prometheus-config.yaml
│   │   ├── grafana-deployment.yaml
│   │   └── dashboards/
│   ├── logging/
│   │   ├── fluent-bit-ds.yaml
│   │   └── elasticsearch.yaml
│   └── network-policy/
│       ├── deny-all.yaml
│       └── allow-intra-namespace.yaml
├── .tekton/
│   └── pipeline.yaml
└── scripts/
    ├── bootstrap.sh       # One-shot cluster setup
    └── verify-health.sh   # Confirms all pods Ready
```

---

## Verification Scripts

```bash
#!/bin/bash
# scripts/verify-health.sh

echo "=== MQ Source Queue Managers ==="
oc get pods -n mq-hackathon -l qm-role=source

echo "=== Redis ==="
oc get pods -n mq-hackathon -l app=redis

echo "=== Liveness probe check ==="
for pod in $(oc get pods -n mq-hackathon -l qm-role=source -o name); do
  oc exec -n mq-hackathon $pod -- curl -sk \
    https://localhost:9443/ibmmq/rest/v2/admin/qmgr | jq '.qmgr[0].state'
done
```

---

## Success Criteria

| Criterion | How to Verify |
|-----------|---------------|
| OCP namespace operational | `oc get pods -n mq-hackathon` — all Running |
| QM.SRC.A and QM.SRC.B accessible | REST API returns `running` state |
| Redis reachable | `redis-cli ping` returns `PONG` |
| Prometheus scraping | Targets page shows all UP |
| Grafana dashboards loaded | Browse to Grafana route |
| CI/CD pipeline runs green | Tekton PipelineRun Succeeded |
| Network policies enforced | External pod cannot reach MQ REST port |

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| OCP quota insufficient | Pre-check with `oc describe quota` before starting |
| MQ image pull fails | Mirror to internal registry; use `imagePullPolicy: IfNotPresent` |
| TLS cert issues on REST API | Use `insecure_skip_verify: true` for dev; replace before demo |
| Redis data loss on pod restart | Mount PersistentVolumeClaim for `/data` |

---

## Handoff to Phase 2

At the end of Phase 1, the team hands off:
- Two running MQ source pods with REST admin accessible at `https://qm-src-a-svc:9443`
- Redis accessible at `redis-svc:6379`
- Monitoring dashboards live
- All team members able to `oc exec` into pods and run `curl` against MQ REST API
- CI/CD pipeline executing on every push to `main`

Phase 2 (BCL Gateway) depends on the MQ REST endpoints and Redis being stable.
