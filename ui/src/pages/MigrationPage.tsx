import { useState } from 'react';
import { Layers, Play } from 'lucide-react';
import AppMigrationCard from '../components/migration/AppMigrationCard';
import MigrationTimeline from '../components/migration/MigrationTimeline';
import LiveIndicator from '../components/shared/LiveIndicator';
import { useMigrations } from '../hooks/useMigrations';
import { useMigrationStream } from '../hooks/useMigrationStream';
import { executeMigration } from '../api/migration';

const APPS = [
  { id: 'APP1', source: 'QM.SRC.A', target: 'QM.APP1' },
  { id: 'APP2', source: 'QM.SRC.A', target: 'QM.APP2' },
  { id: 'APP3', source: 'QM.SRC.A', target: 'QM.APP3' },
  { id: 'APP4', source: 'QM.SRC.B', target: 'QM.APP4' },
  { id: 'APP5', source: 'QM.SRC.B', target: 'QM.APP5' },
  { id: 'APP6', source: 'QM.SRC.B', target: 'QM.APP6' },
];

export default function MigrationPage() {
  const { migrations, triggerMigration, rollbackApp, isLoading } = useMigrations();
  const [bulkRunning, setBulkRunning] = useState(false);
  useMigrationStream();

  const migratedCount = Object.values(migrations).filter((m) => m.state === 'MIGRATED').length;
  const progress = (migratedCount / APPS.length) * 100;
  const allMigrated = migratedCount === APPS.length;

  const migrateAll = async () => {
    setBulkRunning(true);
    for (const app of APPS) {
      const state = migrations[app.id]?.state ?? 'IDLE';
      if (state === 'IDLE' || state === 'ROLLED_BACK') {
        try {
          await executeMigration(app.id, app.source, app.target);
        } catch {
          // continue with others
        }
        await new Promise((res) => setTimeout(res, 1500));
      }
    }
    setBulkRunning(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-slate-600" />
          <h1 className="text-xl font-semibold text-slate-900">Migration Console</h1>
        </div>
        <div className="flex items-center gap-4">
          <LiveIndicator />
          <div className="text-sm text-slate-500">
            <span className="font-semibold text-slate-900">{migratedCount}</span>
            <span className="text-slate-400"> / {APPS.length} apps migrated</span>
          </div>
          {!allMigrated && (
            <button
              onClick={migrateAll}
              disabled={bulkRunning || isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              <Play className="w-3 h-3" />
              {bulkRunning ? 'Migrating all…' : 'Migrate all'}
            </button>
          )}
        </div>
      </div>

      {/* Overall progress bar */}
      <div>
        <div className="flex justify-between text-xs text-slate-500 mb-1.5">
          <span>Overall progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Timeline */}
      <MigrationTimeline apps={APPS} migrations={migrations} />

      {/* App cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {APPS.map((app) => (
          <AppMigrationCard
            key={app.id}
            app={app}
            record={migrations[app.id]}
            onMigrate={() => triggerMigration(app.id, app.source, app.target)}
            onRollback={() => rollbackApp(app.id)}
            isLoading={isLoading}
          />
        ))}
      </div>
    </div>
  );
}
