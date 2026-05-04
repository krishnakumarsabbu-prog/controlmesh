# Runbook: Rotate MQ Admin Password

## Steps

### 1. Update the OCP secret

```bash
oc create secret generic mq-admin-creds \
  --from-literal=password='<new-password>' \
  --dry-run=client -o yaml | oc apply -f -
```

### 2. Rolling restart BCL pods to pick up the new secret

```bash
oc rollout restart deployment/bcl-gateway -n mq-hackathon
```

### 3. Verify BCL is healthy

```bash
oc rollout status deployment/bcl-gateway -n mq-hackathon
curl http://bcl-gateway-svc:8000/healthz/ready
```

### 4. Update sealed-secrets.yaml for GitOps tracking

Re-seal the new password and commit `ocp/secrets/sealed-secrets.yaml`:

```bash
echo -n '<new-password>' | kubeseal --raw --from-file=/dev/stdin \
  --namespace mq-hackathon --name mq-admin-creds --cert pub-cert.pem
```

Replace the `password` value in `ocp/secrets/sealed-secrets.yaml` and commit.
