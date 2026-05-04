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
      <Row cssVar="--accent-success" label="Migrated" count={counts.migrated} />
      <Row cssVar="--accent-primary" label="Active" count={counts.active} />
      <Row cssVar="--accent-danger" label="Rolled back" count={counts.rolledBack} />
      <Row cssVar="--surface-muted" label="Idle" count={counts.idle} dim />

      {total > 0 && (
        <div className="pt-1">
          <div className="w-full h-1 rounded-full overflow-hidden bg-surface-overlay">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${migratedPct}%`,
                background: 'var(--accent-success)',
                boxShadow: migratedPct > 0 ? '0 0 6px var(--accent-glow)' : 'none',
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
  cssVar,
  label,
  count,
  dim,
}: {
  cssVar: string;
  label: string;
  count: number;
  dim?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{
            background: `var(${cssVar})`,
            boxShadow: count > 0 && !dim ? `0 0 5px var(${cssVar})` : 'none',
          }}
        />
        <span className="text-[11px] text-text-secondary">{label}</span>
      </div>
      <span
        className="text-[11px] font-bold tabular-nums"
        style={{ color: count > 0 ? `var(${cssVar})` : 'var(--text-muted)' }}
      >
        {count}
      </span>
    </div>
  );
}
