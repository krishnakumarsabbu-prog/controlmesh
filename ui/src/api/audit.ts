import { bclClient } from './client';
import type { AuditEvent } from '../types';

export interface AuditFilters {
  operation?: string;
  qm?: string;
  limit?: number;
}

export async function fetchAuditLog(filters: AuditFilters = {}): Promise<AuditEvent[]> {
  const params = new URLSearchParams({ limit: String(filters.limit ?? 200) });
  if (filters.operation) params.set('operation', filters.operation);
  if (filters.qm) params.set('qm', filters.qm);
  const { data } = await bclClient.get(`/api/audit?${params}`);
  return data.events ?? [];
}
