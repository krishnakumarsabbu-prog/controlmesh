#!/bin/bash
# One-shot cluster setup for Phase 1.
# Run once per cluster from a machine with `oc` authenticated as cluster-admin.
set -euo pipefail

NAMESPACE="mq-hackathon"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OCP_DIR="${SCRIPT_DIR}/../ocp"

log() { echo "[$(date +%H:%M:%S)] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

# ── Preflight ──────────────────────────────────────────────────────────────────
log "Checking oc login..."
oc whoami >/dev/null 2>&1 || die "Not logged in. Run: oc login <cluster-url>"

log "Checking quota..."
CURRENT_PODS=$(oc get pods -n "${NAMESPACE}" --no-headers 2>/dev/null | wc -l || echo 0)
log "Current pods in ${NAMESPACE}: ${CURRENT_PODS}"

# ── Namespace and RBAC ────────────────────────────────────────────────────────
log "Applying namespace and service accounts..."
oc apply -f "${OCP_DIR}/namespace.yaml"

log "Applying RBAC roles and bindings..."
oc apply -f "${OCP_DIR}/rbac/"

# ── Secrets (skip if already present to avoid overwriting) ───────────────────
log "Creating MQ admin credentials secret (if not present)..."
if ! oc get secret mq-admin-creds -n "${NAMESPACE}" >/dev/null 2>&1; then
  read -rsp "Enter MQ admin password: " MQ_PASS
  echo
  oc create secret generic mq-admin-creds \
    --from-literal=password="${MQ_PASS}" \
    -n "${NAMESPACE}"
fi

log "Creating Redis credentials secret (if not present)..."
if ! oc get secret redis-creds -n "${NAMESPACE}" >/dev/null 2>&1; then
  read -rsp "Enter Redis password: " REDIS_PASS
  echo
  oc create secret generic redis-creds \
    --from-literal=password="${REDIS_PASS}" \
    -n "${NAMESPACE}"
fi

# ── TLS certificate for MQ REST Admin API ────────────────────────────────────
log "Generating self-signed TLS cert for MQ REST admin (dev only)..."
if ! oc get secret mq-tls-secret -n "${NAMESPACE}" >/dev/null 2>&1; then
  TMP_DIR=$(mktemp -d)
  trap 'rm -rf "${TMP_DIR}"' EXIT
  openssl req -x509 -newkey rsa:4096 \
    -keyout "${TMP_DIR}/mq-tls.key" \
    -out "${TMP_DIR}/mq-tls.crt" \
    -days 365 -nodes \
    -subj "/CN=qm-src-a-svc.${NAMESPACE}.svc.cluster.local"
  oc create secret tls mq-tls-secret \
    --cert="${TMP_DIR}/mq-tls.crt" \
    --key="${TMP_DIR}/mq-tls.key" \
    -n "${NAMESPACE}"
fi

# ── Pod Security ──────────────────────────────────────────────────────────────
log "Applying restricted SCC to service accounts..."
oc adm policy add-scc-to-serviceaccount restricted \
  -z bcl-gateway -n "${NAMESPACE}" || true
oc adm policy add-scc-to-serviceaccount restricted \
  -z mq-fleet-manager -n "${NAMESPACE}" || true

# ── Network Policies ──────────────────────────────────────────────────────────
log "Applying network policies..."
oc apply -f "${OCP_DIR}/network-policy/"

# ── MQ Fleet ──────────────────────────────────────────────────────────────────
log "Deploying MQ source queue managers..."
oc apply -f "${OCP_DIR}/mq/qm-src-a.yaml"
oc apply -f "${OCP_DIR}/mq/qm-src-b.yaml"

# ── Redis ─────────────────────────────────────────────────────────────────────
log "Deploying Redis state store..."
oc apply -f "${OCP_DIR}/redis/redis.yaml"

# ── Monitoring ────────────────────────────────────────────────────────────────
log "Deploying Prometheus..."
oc apply -f "${OCP_DIR}/monitoring/prometheus-config.yaml"
oc apply -f "${OCP_DIR}/monitoring/prometheus-deployment.yaml"

log "Building Grafana dashboards ConfigMap..."
oc create configmap grafana-dashboards \
  --from-file="${OCP_DIR}/monitoring/dashboards/mq-fleet-overview.json" \
  --from-file="${OCP_DIR}/monitoring/dashboards/bcl-gateway.json" \
  --from-file="${OCP_DIR}/monitoring/dashboards/migration-progress.json" \
  --from-file="${OCP_DIR}/monitoring/dashboards/agent-mesh.json" \
  -n "${NAMESPACE}" --dry-run=client -o yaml | oc apply -f -

oc apply -f "${OCP_DIR}/monitoring/dashboards/dashboard-provision.yaml"
oc apply -f "${OCP_DIR}/monitoring/grafana-deployment.yaml"

# ── Logging ───────────────────────────────────────────────────────────────────
log "Deploying ELK stack and Fluent Bit..."
oc apply -f "${OCP_DIR}/logging/elasticsearch.yaml"
oc apply -f "${OCP_DIR}/logging/fluent-bit-ds.yaml"

# ── Tekton Pipeline ───────────────────────────────────────────────────────────
log "Applying Tekton tasks and pipeline..."
oc apply -f ".tekton/tasks.yaml"
oc apply -f ".tekton/pipeline.yaml"
oc apply -f ".tekton/trigger.yaml"

log "Bootstrap complete. Run scripts/verify-health.sh to confirm all pods are Ready."
