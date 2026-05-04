#!/usr/bin/env bash
# Collect post-migration evidence artifacts.
# Usage: BCL_URL=http://bcl-gateway-svc:8000 bash scripts/collect_evidence.sh

set -euo pipefail

BCL_URL="${BCL_URL:-http://bcl-gateway-svc:8000}"
OUT="evidence"
mkdir -p "$OUT"

echo "[evidence] collecting from $BCL_URL → $OUT/"

# 1. Integration test log (run separately with pytest; captured by CI task)
#    pytest tests/integration/ -v --tb=short > evidence/integration-tests.txt

# 2. Per-app migration history and validation history
for app in APP1 APP2 APP3 APP4 APP5 APP6; do
  echo "[evidence] migration history for $app"
  curl -sf "$BCL_URL/api/migration/$app/history" \
    -o "$OUT/migration-${app}-history.json" || echo "  warn: $app history unavailable"

  echo "[evidence] validation history for $app"
  curl -sf "$BCL_URL/api/validate/$app/history" \
    -o "$OUT/validation-${app}.json" || echo "  warn: $app validation unavailable"
done

# 3. Audit log snapshot
echo "[evidence] audit log"
curl -sf "$BCL_URL/api/audit?limit=500" \
  -o "$OUT/audit-log.json"

# 4. Fleet state
echo "[evidence] fleet state"
curl -sf "$BCL_URL/api/fleet" \
  -o "$OUT/fleet-post-migration.json"

# 5. Migration status summary
echo "[evidence] migration status"
curl -sf "$BCL_URL/api/migration/status" \
  -o "$OUT/migration-status.json"

# 6. Health check
echo "[evidence] health"
curl -sf "$BCL_URL/healthz/ready" \
  -o "$OUT/health-ready.json" || echo "  warn: health check unavailable"

echo "[evidence] done. Files written to $OUT/"
ls -lh "$OUT/"
