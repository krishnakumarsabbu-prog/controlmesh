import { useState } from 'react';
import { Layers, Play, CircleCheck as CheckCircle } from 'lucide-react';
import { executeMigration } from '../../api/migration';
import { useMigrations } from '../../hooks/useMigrations';
import StateBadge from '../migration/StateBadge';

const REMAINING_APPS = [
  { id: 'APP2', source: 'QM.SRC.A', target: 'QM.APP2' },
  { id: 'APP3', source: 'QM.SRC.A', target: 'QM.APP3' },
  { id: 'APP4', source: 'QM.SRC.B', target: 'QM.APP4' },
  { id: 'APP5', source: 'QM.SRC.B', target: 'QM.APP5' },
  { id: 'APP6', source: 'QM.SRC.B', target: 'QM.APP6' },
];

export default function BulkMigratePanel() {
  const { migrations } = useMigrations();
  const [running, setRunning] = useState(false);
  const [triggered, setTriggered] = useState<Set<string>>(new Set());

  const migrateAll = async () => {
    setRunning(true);
    for (const app of REMAINING_APPS) {
      const state = migrations[app.id]?.state ?? 'IDLE';
      if (state === 'IDLE' || state === 'ROLLED_BACK') {
        try {
          await executeMigration(app.id, app.source, app.target);
          setTriggered((prev) => new Set([...prev, app.id]));
        } catch {
          // continue with others
        }
        await new Promise((res) => setTimeout(res, 1500));
      }
    }
    setRunning(false);
  };

  const allMigrated = REMAINING_APPS.every((a) => migrations[a.id]?.state === 'MIGRATED');
  const migratedCount = REMAINING_APPS.filter((a) => migrations[a.id]?.state === 'MIGRATED').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-secondary">
          Migrate APP2–APP6 sequentially to their dedicated queue managers.
          Each migration is fully automated — provision, rewire, validate.
        </p>
        <button
          onClick={migrateAll}
          disabled={running || allMigrated}
          className="btn-primary"
        >
          {allMigrated ? <CheckCircle className="w-3 h-3" /> : <Layers className="w-3 h-3" />}
          {allMigrated ? 'All migrated' : running ? 'Migrating…' : 'Migrate APP2–APP6'}
        </button>
      </div>

      <div className="space-y-2">
        {REMAINING_APPS.map((app) => {
          const record = migrations[app.id];
          const state = record?.state ?? 'IDLE';
          return (
            <div key={app.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-surface-border bg-surface-raised">
              <span className="text-xs font-semibold text-text-primary w-12 shrink-0">{app.id}</span>
              <span className="text-[11px] font-mono text-text-muted flex-1 truncate">
                {app.source} → {app.target}
              </span>
              <StateBadge state={state} />
              {triggered.has(app.id) && state !== 'MIGRATED' && (
                <Play className="w-3 h-3 animate-pulse shrink-0" style={{ color: 'var(--accent-warning)' }} />
              )}
            </div>
          );
        })}
      </div>

      {migratedCount > 0 && (
        <div
          className="rounded-lg px-3 py-2 text-xs font-semibold border"
          style={{
            background: `color-mix(in srgb, var(${allMigrated ? '--accent-success' : '--accent-warning'}) 10%, var(--surface-card))`,
            borderColor: `color-mix(in srgb, var(${allMigrated ? '--accent-success' : '--accent-warning'}) 30%, transparent)`,
            color: `var(${allMigrated ? '--accent-success' : '--accent-warning'})`,
          }}
        >
          {allMigrated
            ? 'Target topology achieved — all 5 remaining apps on dedicated QMs'
            : `${migratedCount}/${REMAINING_APPS.length} migrations complete`}
        </div>
      )}
    </div>
  );
}
