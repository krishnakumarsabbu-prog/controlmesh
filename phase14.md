# Phase 14: Deployment and Go-Live (Hackathon Demo)

**Duration:** 1–2 days
**Objective:** Execute the production deployment, run the go-live validation sequence, train the team on demo talking points, and execute the full hackathon demonstration from source topology through complete migration of all 6 applications.

---

## Context and Rationale

Phase 14 is the hackathon demo day preparation and execution. The goal is not just to have the system running — it is to tell a compelling story that directly maps to the judging criteria:

1. BCL API enforcing all guardrails
2. UI control plane backed by BCL
3. Source topology provisioned through BCL
4. Migration executed step by step with evidence
5. Transparent connection handling demonstrated
6. Validation and automated rollback demonstrated

The demo should be structured as a 20–30 minute narrative with live system interactions backed by pre-captured evidence.

---

## Final Deployment Sequence

```bash
#!/bin/bash
# scripts/deploy-production.sh
# Run this on demo day, ~2 hours before presentation

set -euo pipefail

NAMESPACE="mq-hackathon"
BCL_IMAGE="bcl-gateway:latest"
UI_IMAGE="mq-ui:latest"

echo "=== Step 1: Apply all OCP manifests ==="
oc apply -f ocp/namespace.yaml
oc apply -f ocp/rbac/
oc apply -f ocp/secrets/
oc apply -f ocp/network-policy/
oc apply -f ocp/redis/
oc apply -f ocp/mq/         # Source QMs only
oc apply -f ocp/monitoring/
oc apply -f ocp/bcl/
oc apply -f ocp/ui/

echo "=== Step 2: Wait for core pods ==="
oc rollout status deployment/redis -n $NAMESPACE
oc rollout status deployment/bcl-gateway -n $NAMESPACE
oc rollout status deployment/mq-ui -n $NAMESPACE
oc rollout status deployment/qm-src-a -n $NAMESPACE
oc rollout status deployment/qm-src-b -n $NAMESPACE

echo "=== Step 3: Provision source topology ==="
python scripts/provision_source_topology.py

echo "=== Step 4: Run pre-demo checks ==="
./scripts/pre-demo-checklist.sh

echo "=== DEPLOYMENT COMPLETE ==="
echo "BCL: $(oc get route bcl-route -n $NAMESPACE -o jsonpath='{.spec.host}')"
echo "UI:  $(oc get route mq-ui-route -n $NAMESPACE -o jsonpath='{.spec.host}')"
```

---

## Demo Script

### Opening (2 minutes)

> "We built a Business Control Layer and UI control plane that automates IBM MQ topology migration. The BCL is the only way to touch MQ objects — every operation goes through it, every operation is audited.
>
> We have 6 applications on a shared source topology. We're going to migrate them one by one to their own dedicated queue managers — fully automated, validated at each step, with automatic rollback if anything goes wrong."

**Show:** UI → Topology page — source topology graph, 6 apps on 2 shared QMs.

---

### Scene 1: Source Topology + BCL Policy (4 minutes)

**Show:** `GET /api/fleet` — 2 source QMs in registry.

**Show:** `GET /api/queues?qm=QM.SRC.A` — 7 queues (6 app + 1 DLQ).

**Demonstrate BCL policy enforcement:**
```bash
# Try to create a queue with bad naming — BCL rejects with 422
curl -X POST http://bcl-route/api/queues \
  -H 'Content-Type: application/json' \
  -d '{"qm":"QM.SRC.A","name":"bad_queue_name","type":"LOCAL"}'
# Expected: 422 POLICY_VIOLATION NAMING_CONVENTION
```

**Show:** `GET /api/audit` — audit trail shows all provisioning operations.

> "Everything went through the BCL. You can see every object creation in the audit trail. The policy engine blocked the non-compliant queue name."

---

### Scene 2: Baseline Validation (2 minutes)

**Show:** UI → Validation panel — all BASELINE badges pending.

```bash
# Run baseline validation for all 6 apps
for app in APP1 APP2 APP3 APP4 APP5 APP6; do
  curl -X POST http://bcl-route/api/validate \
    -d "{\"app_id\":\"$app\",\"qm_name\":\"QM.SRC.A\",\"queue_name\":\"Q.${app}.REQUEST.LOCAL\",\"phase\":\"BASELINE\"}"
done
```

**Show:** UI → Validation panel — all 6 BASELINE badges turn green.

> "All 6 applications have confirmed working message flows on the source topology before we touch anything."

---

### Scene 3: First Migration — APP1 (8 minutes)

**Show:** UI → Migration console, APP1 row in IDLE state.

**Click Migrate on APP1** (or via curl):
```bash
curl -X POST http://bcl-route/api/migration/execute \
  -H 'Content-Type: application/json' \
  -d '{"app_id":"APP1","source_qm":"QM.SRC.A","target_qm":"QM.APP1"}'
```

**Watch live in UI:**
- APP1 → SNAPSHOTTED (Redis checkpoint saved)
- APP1 → PROVISIONING_TARGET (new QM pod spinning up)
- APP1 → REWIRING (xmit queue + remote def installed)
- APP1 → VALIDATING (put/get test running)
- APP1 → MIGRATED (green)

**Show:** UI → Topology graph — APP1 node animates from QM.SRC.A to QM.APP1.

**Show:** Validation panel — APP1 POST_REWIRE and FINAL badges turn green.

> "The Orchestrator agent managed the full sequence — provisioning, rewiring, validation. The ADK agents called the BCL tools in the right order. The BCL enforced naming and DLQ throughout.
>
> Crucially: the producer never changed its connection string. During rewiring, it PUT to QM.SRC.A and the remote queue definition silently routed the message to QM.APP1. That's transparent rewiring."

---

### Scene 4: Rollback Demonstration (4 minutes)

**Show:** Trigger a deliberate failure by migrating APP2 with a broken target:
```bash
# Demonstrate rollback by migrating to a non-existent target QM
curl -X POST http://bcl-route/api/migration/execute \
  -H 'Content-Type: application/json' \
  -d '{"app_id":"APP2","source_qm":"QM.SRC.A","target_qm":"QM.APP2.BROKEN"}'
```

**Watch live in UI:**
- APP2 → REWIRING
- APP2 → VALIDATING (POST_REWIRE fails — timeout)
- APP2 → ROLLING_BACK
- APP2 → ROLLED_BACK

**Show:** UI → APP2 row shows ROLLED_BACK with error detail.

**Show:** Source queue still present:
```bash
curl http://bcl-route/api/queues?qm=QM.SRC.A | jq '[.queues[].name]'
# Q.APP2.REQUEST.LOCAL still there
```

**Show:** Source flow validated:
```bash
curl -X POST http://bcl-route/api/validate \
  -d '{"app_id":"APP2","qm_name":"QM.SRC.A","queue_name":"Q.APP2.REQUEST.LOCAL","phase":"BASELINE"}'
# passed: true
```

> "The validation timeout triggered automatic rollback. The rollback agent removed all rewiring artefacts and restored the source queue. The system emitted clear signals in logs, health probes, and the API. No manual intervention required."

---

### Scene 5: Migrate All Remaining Apps (5 minutes)

Migrate APP2–APP6 sequentially (or show pre-recorded to save time):

```bash
for app in APP2 APP3 APP4 APP5 APP6; do
  qm_src=$([ "$app" \< "APP4" ] && echo "QM.SRC.A" || echo "QM.SRC.B")
  curl -X POST http://bcl-route/api/migration/execute \
    -H 'Content-Type: application/json' \
    -d "{\"app_id\":\"$app\",\"source_qm\":\"$qm_src\",\"target_qm\":\"QM.$app\"}"
  sleep 2
done
```

**Show:** UI → Topology graph, target state — 6 QMs each with one app.

**Show:** Validation panel — all 6 apps × all 3 phases = 18 green badges.

> "Target topology achieved. Six applications, six dedicated queue managers. Each migration validated at three points. The system is in the exact state defined in the target topology spec."

---

### Closing (2 minutes)

**Show:** Grafana dashboard — queue depths all zero, all channels RUNNING, BCL p99 < 200ms.

**Show:** `GET /api/audit` — complete chronological audit trail of every operation.

> "This is production-quality automation. The BCL enforces all guardrails. The ADK agent mesh handles the reasoning. The UI gives operators full visibility. And it's all running on OpenShift within your quota."

---

## Evidence Package

After the demo, package evidence:

```bash
#!/bin/bash
# scripts/collect-evidence.sh
mkdir -p evidence/

# Fleet state
curl -s http://bcl-route/api/fleet > evidence/01-fleet-final.json

# All migration histories
for app in APP1 APP2 APP3 APP4 APP5 APP6; do
  curl -s "http://bcl-route/api/migration/$app/history" \
    > "evidence/02-migration-$app-history.json"
  curl -s "http://bcl-route/api/validate/$app/history" \
    > "evidence/03-validation-$app.json"
done

# Queue state on all target QMs
for app in APP1 APP2 APP3 APP4 APP5 APP6; do
  curl -s "http://bcl-route/api/queues?qm=QM.$app" \
    > "evidence/04-queues-QM.$app.json"
done

# Full audit log
curl -s "http://bcl-route/api/audit?limit=1000" > evidence/05-audit-log.json

# Migration status snapshot
curl -s "http://bcl-route/api/migration/status" > evidence/06-migration-status.json

# OCP pod states
oc get pods -n mq-hackathon -o json > evidence/07-ocp-pods.json

echo "Evidence collected in ./evidence/"
ls -la evidence/
```

---

## Deliverables Checklist

| Deliverable | Status |
|-------------|--------|
| BCL API implementation with policy enforcement | Phases 2, 10 |
| Evidence: source topology provisioned via BCL | `evidence/01-fleet-final.json` + audit log |
| Evidence: migration executed via BCL | `evidence/02-migration-*-history.json` |
| UI control plane with all 4 views | Phase 11 |
| UI backed by BCL | Zero direct MQ calls in UI code |
| Migration demonstration: source → target | Demo recording |
| Evidence per migration step | `evidence/02-*` + `evidence/03-*` |
| Transparent connection handling evidence | Audit log shows rewiring; validation passes |
| Automated validation: before/during/after | 18 validation results in `evidence/03-*` |
| Automated rollback demonstration | Demo recording + `evidence/02-APP2-history.json` |
| BCL API reference | `GET /api/docs` (Swagger UI) |
| Architecture overview | Phase diagrams + system diagrams |
| UI overview | Phase 11 documentation |
| Current-state topology diagram | Phase 6 source topology table |
| Future-state topology diagram | 6 × dedicated QM topology |
| Migration plan description | Phase 7 migration plan table |
| Rollback mechanism explanation | Phase 9 rollback sequence |
| Validation approach | Phase 8 validation matrix |
| Presentation + screen recording | Demo script above |

---

## Success Criteria

| Criterion | Verification |
|-----------|-------------|
| All 6 apps migrated to target topology | UI shows all MIGRATED |
| Automated rollback demonstrated | APP2 ROLLED_BACK in demo |
| Source topology restored post-rollback | `Q.APP2.REQUEST.LOCAL` present on `QM.SRC.A` |
| Validation matrix: 18/18 green | Validation panel screenshot |
| Transparent rewiring evidenced | Audit log shows REWIRING + POST_REWIRE PASS |
| BCL policy enforcement demonstrated | 422 response on bad queue name |
| Complete audit trail available | `GET /api/audit` shows full history |
| OCP health probes passing | All pods Running + Ready |
| Grafana dashboards active | Queue depths, channel status, BCL latency |
| Evidence package collected | `evidence/` directory with all files |
