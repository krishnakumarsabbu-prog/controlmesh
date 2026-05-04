import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import AuditTimeline from '../components/audit/AuditTimeline';
import RollbackPanel from '../components/audit/RollbackPanel';
import EventFilters from '../components/audit/EventFilters';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { useMigrations } from '../hooks/useMigrations';
import { useAudit } from '../hooks/useAudit';

interface Filters { operation: string; qm: string; agent: string; }

export default function AuditPage() {
  const [filters, setFilters] = useState<Filters>({ operation: '', qm: '', agent: '' });
  const { migrations } = useMigrations();
  const { data: events, isLoading } = useAudit({
    operation: filters.operation || undefined,
    qm: filters.qm || undefined,
    limit: 200,
  });

  const rolledBackApps = Object.values(migrations).filter(
    (m) => m.state === 'ROLLED_BACK'
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScrollText className="w-5 h-5 text-text-secondary" />
          <h1 className="text-xl font-semibold text-text-primary">Audit Log</h1>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <LoadingSpinner size="sm" />}
          <span className="text-sm text-text-secondary">
            <span className="font-semibold text-text-primary">{events?.length ?? 0}</span>
            {' '}events
          </span>
        </div>
      </div>

      {/* Rollback alerts */}
      {rolledBackApps.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/20 p-4">
          <div className="text-sm font-semibold text-warning mb-3">
            Rollback Events ({rolledBackApps.length})
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rolledBackApps.map((app) => (
              <RollbackPanel key={app.app_id} record={app} />
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <EventFilters filters={filters} onChange={setFilters} />

      {/* Timeline */}
      <AuditTimeline events={events ?? []} />
    </div>
  );
}
