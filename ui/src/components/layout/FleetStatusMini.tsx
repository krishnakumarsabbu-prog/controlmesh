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

  return (
    <div className="space-y-1.5">
      <Row color="bg-emerald-500" label="Migrated" count={counts.migrated} />
      <Row color="bg-amber-400" label="Active" count={counts.active} />
      <Row color="bg-orange-400" label="Rolled back" count={counts.rolledBack} />
      <Row color="bg-slate-500" label="Idle" count={counts.idle} />
    </div>
  );
}

function Row({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <span className="text-xs text-slate-300 font-semibold tabular-nums">{count}</span>
    </div>
  );
}
