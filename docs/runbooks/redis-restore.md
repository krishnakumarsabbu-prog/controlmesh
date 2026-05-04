# Runbook: Restore Redis from Backup

## Symptoms

- Redis pod lost its PVC
- Migration state missing after Redis restart

## Steps

### 1. Find the latest backup file

```bash
oc exec -n mq-hackathon deployment/redis -- \
  ls -lt /backup/*.rdb | head -5
```

### 2. Copy the backup into the running Redis container

```bash
LATEST=$(oc exec -n mq-hackathon deployment/redis -- \
  ls -t /backup/*.rdb | head -1)
oc exec -n mq-hackathon deployment/redis -- \
  cp "$LATEST" /data/dump.rdb
```

### 3. Restart Redis to load the snapshot

```bash
oc rollout restart deployment/redis -n mq-hackathon
oc rollout status deployment/redis -n mq-hackathon
```

### 4. Verify state was restored

```bash
oc exec -n mq-hackathon deployment/redis -- \
  redis-cli -a "$REDIS_PASSWORD" --no-auth-warning KEYS "migration:*"
```

### 5. Restart BCL to reconnect

```bash
oc rollout restart deployment/bcl-gateway -n mq-hackathon
```
