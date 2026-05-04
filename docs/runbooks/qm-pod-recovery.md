# Runbook: Recover from QM Pod Loss

## Symptoms

- `mq_qm_connected{qm_name="QM.APP1"} == 0` fires for > 2 minutes
- `/healthz/ready` returns 503
- Migrations stuck in `PROVISIONING_TARGET` or `REWIRING`

## Steps

### 1. Check pod status

```bash
oc get pods -n mq-hackathon -l qm-name=QM.APP1
```

### 2. If pod is in CrashLoopBackOff

```bash
oc logs -n mq-hackathon <pod-name> --previous
oc describe pod -n mq-hackathon <pod-name>
```

### 3. Force pod restart

```bash
oc rollout restart deployment/qm-app1 -n mq-hackathon
```

### 4. If pod will not start (image pull / resource issue)

```bash
# Check quota
oc describe quota -n mq-hackathon
# Check recent events
oc get events -n mq-hackathon --sort-by='.lastTimestamp' | tail -20
```

### 5. After pod recovers — trigger rollback for stuck migrations

```bash
curl -X POST http://bcl-gateway-svc:8000/api/migration/APP1/rollback
```

### 6. Verify source topology is restored

```bash
curl http://bcl-gateway-svc:8000/api/queues?qm=QM.SRC.A
```

### 7. Re-attempt migration

```bash
curl -X POST http://bcl-gateway-svc:8000/api/migration/execute \
  -H 'Content-Type: application/json' \
  -d '{"app_id":"APP1","source_qm":"QM.SRC.A","target_qm":"QM.APP1"}'
```

## Escalation

If the pod continues crashing after three restarts, collect diagnostics:

```bash
oc adm must-gather -n mq-hackathon
```

and review IBM MQ container logs for license or configuration errors.
