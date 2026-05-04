import { bclClient } from './client';
import type { MigrationRecord } from '../types';

export async function fetchAllMigrations(): Promise<MigrationRecord[]> {
  const { data } = await bclClient.get('/api/migration/status');
  return data.migrations ?? data ?? [];
}

export async function fetchMigrationStatus(appId: string): Promise<MigrationRecord> {
  const { data } = await bclClient.get(`/api/migration/${appId}/status`);
  return data;
}

export async function executeMigration(
  appId: string,
  sourceQm: string,
  targetQm: string
): Promise<void> {
  await bclClient.post('/api/migration/execute', {
    app_id: appId,
    source_qm: sourceQm,
    target_qm: targetQm,
  });
}

export async function rollbackMigration(appId: string): Promise<void> {
  await bclClient.post(`/api/migration/${appId}/rollback`);
}
