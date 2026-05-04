import { useQuery } from '@tanstack/react-query';
import { fetchLogs, type LogFilters } from '../api/logs';
import type { LogEntry } from '../types';

export function useLogs(filters: LogFilters = {}) {
  return useQuery<LogEntry[]>({
    queryKey: ['logs', filters],
    queryFn: () => fetchLogs(filters),
    refetchInterval: 4000,
    staleTime: 2000,
  });
}
