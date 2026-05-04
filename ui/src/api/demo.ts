import { bclClient } from './client';

export async function fetchQueues(qm: string) {
  const { data } = await bclClient.get(`/api/queues?qm=${encodeURIComponent(qm)}`);
  return data;
}

export async function createQueue(qm: string, name: string, type = 'LOCAL') {
  const { data } = await bclClient.post('/api/queues', { qm, name, type });
  return data;
}

export async function runBaselineValidation(appId: string, qmName: string, queueName: string) {
  const { data } = await bclClient.post('/api/validate', {
    app_id: appId,
    qm_name: qmName,
    queue_name: queueName,
    phase: 'BASELINE',
  });
  return data;
}

export async function fetchMigrationHistory(appId: string) {
  const { data } = await bclClient.get(`/api/migration/${appId}/history`);
  return data;
}

export async function fetchValidationHistory(appId: string) {
  const { data } = await bclClient.get(`/api/validate/${appId}/history`);
  return data;
}

export async function fetchFleetRaw() {
  const { data } = await bclClient.get('/api/fleet');
  return data;
}

export async function fetchAuditRaw(limit = 1000) {
  const { data } = await bclClient.get(`/api/audit?limit=${limit}`);
  return data;
}

export async function fetchMigrationStatus() {
  const { data } = await bclClient.get('/api/migration/status');
  return data;
}
