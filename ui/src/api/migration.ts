import { bclClient, IS_MOCK } from './client';
import { mockApi } from './mock/service';
import type { MigrationRecord } from '../types';

export async function fetchAllMigrations(): Promise<MigrationRecord[]> {
  if (IS_MOCK) return mockApi.getAllMigrations();
  const { data } = await bclClient.get('/api/migration/status');
  return data.migrations ?? data ?? [];
}

export async function fetchMigrationStatus(appId: string): Promise<MigrationRecord> {
  if (IS_MOCK) return mockApi.getMigrationStatus(appId);
  const { data } = await bclClient.get(`/api/migration/${appId}/status`);
  return data;
}

export async function executeMigration(
  appId: string,
  sourceQm: string,
  targetQm: string
): Promise<void> {
  if (IS_MOCK) return mockApi.executeMigration(appId, sourceQm, targetQm);
  await bclClient.post('/api/migration/execute', {
    app_id: appId,
    source_qm: sourceQm,
    target_qm: targetQm,
  });
}

export async function rollbackMigration(appId: string): Promise<void> {
  if (IS_MOCK) return mockApi.rollbackMigration(appId);
  await bclClient.post(`/api/migration/${appId}/rollback`);
}
