import { useAppStore } from '../../store/appStore';

export default function FleetStatusMini() {
  const migrations = useAppStore((s) => s.migrations);
  const counts = Object.values(migrations).reduce(
    (acc, m) => {
      if (m.state === 'MIGRATED') acc.migrated++;
      else if (['PROVISIONING_TARGET', 'REWIRING', 'VALIDATING', 'SNAPSHOTTED'].includes(m.state)) acc.active++;
      else if (m.state === 'ROLLED_BACK') acc.rolledBack++;
      else acc.idle++;
      return acc;
    },
    { migrated: 0, active: 0, rolledBack: 0, idle: 0 }
  );

  const total = counts.migrated + counts.active + counts.rolledBack + counts.idle;
  const migratedPct = total > 0 ? (counts.migrated / total) * 100 : 0;

  return (
    <div className="space-y-2">
      <Row
        color="#22C55E"
        glow="rgba(34,197,94,0.5)"
        label="Migrated"
        count={counts.migrated}
      />
      <Row
        color="#6366F1"
        glow="rgba(99,102,241,0.5)"
        label="Active"
        count={counts.active}
      />
      <Row
        color="#EF4444"
        glow="rgba(239,68,68,0.5)"
        label="Rolled back"
        count={counts.rolledBack}
      />
      <Row
        color="#2A3550"
        glow="transparent"
        label="Idle"
        count={counts.idle}
      />

      {/* Mini progress bar */}
      {total > 0 && (
        <div className="pt-1">
          <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: '#1A2236' }}>
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${migratedPct}%`,
                background: 'linear-gradient(90deg, #22C55E, #16A34A)',
                boxShadow: migratedPct > 0 ? '0 0 6px rgba(34,197,94,0.4)' : 'none',
              }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-text-muted">Progress</span>
            <span className="text-[10px] text-text-secondary font-semibold tabular-nums">
              {Math.round(migratedPct)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  color,
  glow,
  label,
  count,
}: {
  color: string;
  glow: string;
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: color, boxShadow: count > 0 ? `0 0 5px ${glow}` : 'none' }}
        />
        <span className="text-[11px] text-text-secondary">{label}</span>
      </div>
      <span
        className="text-[11px] font-bold tabular-nums"
        style={{ color: count > 0 ? color : '#6B7280' }}
      >
        {count}
      </span>
    </div>
  );
}
