import { bclClient, IS_MOCK } from './client';
import { mockApi } from './mock/service';

export async function fetchQueues(qm: string) {
  if (IS_MOCK) return mockApi.getQueues(qm);
  const { data } = await bclClient.get(`/api/queues?qm=${encodeURIComponent(qm)}`);
  return data;
}

export async function createQueue(qm: string, name: string, type = 'LOCAL') {
  if (IS_MOCK) return mockApi.createQueue(qm, name, type);
  const { data } = await bclClient.post('/api/queues', { qm, name, type });
  return data;
}

export async function runBaselineValidation(appId: string, qmName: string, queueName: string) {
  if (IS_MOCK) return mockApi.runBaselineValidation(appId, qmName, queueName);
  const { data } = await bclClient.post('/api/validate', {
    app_id: appId,
    qm_name: qmName,
    queue_name: queueName,
    phase: 'BASELINE',
  });
  return data;
}

export async function fetchMigrationHistory(appId: string) {
  if (IS_MOCK) return mockApi.getMigrationHistory(appId);
  const { data } = await bclClient.get(`/api/migration/${appId}/history`);
  return data;
}

export async function fetchValidationHistory(appId: string) {
  if (IS_MOCK) return mockApi.getValidationHistory(appId);
  const { data } = await bclClient.get(`/api/validate/${appId}/history`);
  return data;
}

export async function fetchFleetRaw() {
  if (IS_MOCK) return mockApi.getFleet();
  const { data } = await bclClient.get('/api/fleet');
  return data;
}

export async function fetchAuditRaw(limit = 1000) {
  if (IS_MOCK) return mockApi.getAuditLog({ limit });
  const { data } = await bclClient.get(`/api/audit?limit=${limit}`);
  return data;
}

export async function fetchMigrationStatus() {
  if (IS_MOCK) return mockApi.getAllMigrations();
  const { data } = await bclClient.get('/api/migration/status');
  return data;
}
