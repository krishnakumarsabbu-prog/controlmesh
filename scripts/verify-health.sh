#!/bin/bash
# Confirms all Phase 1 pods are Ready and key services are reachable.
set -euo pipefail

NAMESPACE="mq-hackathon"
PASS=0
FAIL=0

ok()   { echo "  [OK]   $*"; ((PASS++)); }
fail() { echo "  [FAIL] $*"; ((FAIL++)); }
section() { echo; echo "=== $* ==="; }

# ── Namespace ─────────────────────────────────────────────────────────────────
section "Namespace"
if oc get namespace "${NAMESPACE}" >/dev/null 2>&1; then
  ok "Namespace ${NAMESPACE} exists"
else
  fail "Namespace ${NAMESPACE} not found"
fi

# ── MQ Source Queue Managers ─────────────────────────────────────────────────
section "MQ Source Queue Managers"
for qm in qm-src-a qm-src-b; do
  POD=$(oc get pods -n "${NAMESPACE}" -l "app=${qm}" \
        --field-selector=status.phase=Running -o name 2>/dev/null | head -1)
  if [ -n "${POD}" ]; then
    ok "${qm} pod Running: ${POD}"
    # Check REST admin via liveness endpoint
    RESULT=$(oc exec -n "${NAMESPACE}" "${POD}" -- \
      curl -sk -o /dev/null -w "%{http_code}" \
      https://localhost:9443/ibmmq/rest/v2/admin/qmgr 2>/dev/null || echo "000")
    if [ "${RESULT}" = "200" ]; then
      ok "${qm} REST admin responding (HTTP 200)"
    else
      fail "${qm} REST admin not responding (HTTP ${RESULT})"
    fi
  else
    fail "${qm} pod not Running"
  fi
done

# ── MQ QM State ───────────────────────────────────────────────────────────────
section "MQ Queue Manager State"
for qm in qm-src-a qm-src-b; do
  POD=$(oc get pods -n "${NAMESPACE}" -l "app=${qm}" \
        --field-selector=status.phase=Running -o name 2>/dev/null | head -1)
  if [ -n "${POD}" ]; then
    STATE=$(oc exec -n "${NAMESPACE}" "${POD}" -- \
      curl -sk https://localhost:9443/ibmmq/rest/v2/admin/qmgr \
      2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['qmgr'][0]['state'])" 2>/dev/null || echo "unknown")
    if [ "${STATE}" = "running" ]; then
      ok "${qm} QM state: running"
    else
      fail "${qm} QM state: ${STATE}"
    fi
  fi
done

# ── Redis ─────────────────────────────────────────────────────────────────────
section "Redis"
REDIS_POD=$(oc get pods -n "${NAMESPACE}" -l app=redis \
  --field-selector=status.phase=Running -o name 2>/dev/null | head -1)
if [ -n "${REDIS_POD}" ]; then
  ok "Redis pod Running: ${REDIS_POD}"
  PONG=$(oc exec -n "${NAMESPACE}" "${REDIS_POD}" -- \
    sh -c 'redis-cli -a "${REDIS_PASSWORD}" ping' 2>/dev/null || echo "")
  if [ "${PONG}" = "PONG" ]; then
    ok "Redis ping: PONG"
  else
    fail "Redis ping failed (got: ${PONG})"
  fi
else
  fail "Redis pod not Running"
fi

# ── Prometheus ────────────────────────────────────────────────────────────────
section "Prometheus"
PROM_POD=$(oc get pods -n "${NAMESPACE}" -l app=prometheus \
  --field-selector=status.phase=Running -o name 2>/dev/null | head -1)
if [ -n "${PROM_POD}" ]; then
  ok "Prometheus pod Running: ${PROM_POD}"
  HEALTH=$(oc exec -n "${NAMESPACE}" "${PROM_POD}" -- \
    wget -qO- http://localhost:9090/-/healthy 2>/dev/null || echo "")
  if [ "${HEALTH}" = "Prometheus Server is Healthy." ]; then
    ok "Prometheus healthy"
  else
    fail "Prometheus health check failed"
  fi
else
  fail "Prometheus pod not Running"
fi

# ── Grafana ───────────────────────────────────────────────────────────────────
section "Grafana"
GRAFANA_POD=$(oc get pods -n "${NAMESPACE}" -l app=grafana \
  --field-selector=status.phase=Running -o name 2>/dev/null | head -1)
if [ -n "${GRAFANA_POD}" ]; then
  ok "Grafana pod Running: ${GRAFANA_POD}"
  HTTP=$(oc exec -n "${NAMESPACE}" "${GRAFANA_POD}" -- \
    wget -qO /dev/null --server-response http://localhost:3000/api/health 2>&1 \
    | grep "HTTP/" | awk '{print $2}' || echo "000")
  if [ "${HTTP}" = "200" ]; then
    ok "Grafana API healthy"
  else
    fail "Grafana API not healthy (HTTP ${HTTP})"
  fi
else
  fail "Grafana pod not Running"
fi

# ── Elasticsearch ─────────────────────────────────────────────────────────────
section "Elasticsearch"
ES_POD=$(oc get pods -n "${NAMESPACE}" -l app=elasticsearch \
  --field-selector=status.phase=Running -o name 2>/dev/null | head -1)
if [ -n "${ES_POD}" ]; then
  ok "Elasticsearch pod Running: ${ES_POD}"
  ES_STATUS=$(oc exec -n "${NAMESPACE}" "${ES_POD}" -- \
    curl -s http://localhost:9200/_cluster/health \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null || echo "unknown")
  if [[ "${ES_STATUS}" =~ ^(green|yellow)$ ]]; then
    ok "Elasticsearch cluster status: ${ES_STATUS}"
  else
    fail "Elasticsearch cluster status: ${ES_STATUS}"
  fi
else
  fail "Elasticsearch pod not Running"
fi

# ── Network Policy Enforcement ────────────────────────────────────────────────
section "Network Policy (external pod isolation)"
# Spin up a temporary pod outside the namespace and verify it cannot hit MQ REST.
EXTERNAL_NS="default"
TEST_RESULT=$(oc run nw-test --image=busybox:1.36 --restart=Never \
  --rm -n "${EXTERNAL_NS}" -it --timeout=15s -- \
  sh -c "wget -T5 -q -O /dev/null \
    https://qm-src-a-svc.${NAMESPACE}.svc.cluster.local:9443 2>&1; echo exit:$?" \
  2>/dev/null || echo "blocked")
if echo "${TEST_RESULT}" | grep -q "blocked\|timed out\|Connection refused"; then
  ok "External pod cannot reach MQ REST port (network policy enforced)"
else
  fail "External pod may be able to reach MQ REST port — review network policies"
fi

# ── Routes ────────────────────────────────────────────────────────────────────
section "OCP Routes"
for route in prometheus-route grafana-route kibana-route; do
  ROUTE_HOST=$(oc get route "${route}" -n "${NAMESPACE}" \
    -o jsonpath='{.spec.host}' 2>/dev/null || echo "")
  if [ -n "${ROUTE_HOST}" ]; then
    ok "Route ${route}: https://${ROUTE_HOST}"
  else
    fail "Route ${route} not found"
  fi
done

# ── Summary ───────────────────────────────────────────────────────────────────
echo
echo "================================================"
echo " Phase 1 Health Check: ${PASS} passed, ${FAIL} failed"
echo "================================================"
if [ "${FAIL}" -gt 0 ]; then
  exit 1
fi
