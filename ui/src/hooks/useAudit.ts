import { useQuery } from '@tanstack/react-query';
import { fetchAuditLog, type AuditFilters } from '../api/audit';

export function useAudit(filters: AuditFilters = {}) {
  return useQuery({
    queryKey: ['audit', filters],
    queryFn: () => fetchAuditLog(filters),
    refetchInterval: 5000,
  });
}
