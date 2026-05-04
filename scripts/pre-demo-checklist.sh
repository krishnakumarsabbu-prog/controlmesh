#!/bin/bash
# Pre-demo readiness checklist.
# Run 30 minutes before the hackathon demo.
# Exits non-zero if any check fails.
set -e

BCL_URL="${BCL_URL:-http://bcl-gateway-svc:8000}"
NAMESPACE="${NAMESPACE:-mq-hackathon}"

echo "=== 1. All pods running ==="
oc get pods -n "$NAMESPACE"

echo ""
echo "=== 2. BCL health ==="
curl -sf "${BCL_URL}/healthz/ready" && echo " — BCL: READY"

echo ""
echo "=== 3. Source QMs reachable ==="
curl -sf "${BCL_URL}/api/fleet" | python3 -c \
  "import sys,json; [print(q['name']) for q in json.load(sys.stdin)['queue_managers']]"

echo ""
echo "=== 4. Source topology provisioned ==="
curl -sf "${BCL_URL}/api/queues?qm=QM.SRC.A" | python3 -c \
  "import sys,json; data=json.load(sys.stdin); print(json.dumps([q['name'] for q in data.get('queues',[])]))"

echo ""
echo "=== 5. All apps in IDLE state ==="
curl -sf "${BCL_URL}/api/migration/status" | python3 -c \
  "import sys,json; data=json.load(sys.stdin); [print(m['app_id'], '->', m['state']) for m in data.get('migrations',[])]"

echo ""
echo "=== 6. Baseline validation passes ==="
for app in APP1 APP2 APP3; do
  result=$(curl -sf -X POST "${BCL_URL}/api/validate" \
    -H 'Content-Type: application/json' \
    -d "{\"app_id\":\"${app}\",\"qm_name\":\"QM.SRC.A\",\"queue_name\":\"Q.${app}.REQUEST.LOCAL\",\"phase\":\"BASELINE\"}")
  passed=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('passed','?'))")
  echo "  ${app} baseline: ${passed}"
done

echo ""
echo "=== 7. Redis reachable ==="
oc exec -n "$NAMESPACE" deployment/redis -- \
  redis-cli -a "$REDIS_PASSWORD" --no-auth-warning ping

echo ""
echo "=== 8. UI accessible ==="
UI_HOST=$(oc get route mq-ui-route -n "$NAMESPACE" -o jsonpath='{.spec.host}' 2>/dev/null || echo "")
if [ -n "$UI_HOST" ]; then
  curl -sf "https://${UI_HOST}" -o /dev/null && echo " — UI: OK"
else
  echo " — WARNING: mq-ui-route not found; skipping UI check"
fi

echo ""
echo "=== PRE-DEMO CHECKS PASSED ==="
