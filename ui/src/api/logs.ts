import { bclClient, IS_MOCK } from './client';
import { mockApi } from './mock/service';
import type { LogEntry, LogCategory, LogLevel } from '../types';

export interface LogFilters {
  category?: LogCategory;
  level?: LogLevel;
  app_id?: string;
  limit?: number;
}

export async function fetchLogs(filters: LogFilters = {}): Promise<LogEntry[]> {
  if (IS_MOCK) return mockApi.getLogs(filters);
  const params = new URLSearchParams({ limit: String(filters.limit ?? 200) });
  if (filters.category) params.set('category', filters.category);
  if (filters.level) params.set('level', filters.level);
  if (filters.app_id) params.set('app_id', filters.app_id);
  const { data } = await bclClient.get(`/api/logs?${params}`);
  return data.logs ?? [];
}
