import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Play, SquareX, Zap, TriangleAlert as AlertTriangle, RotateCcw } from 'lucide-react';
import AppMigrationCard from '../components/migration/AppMigrationCard';
import MigrationTimeline from '../components/migration/MigrationTimeline';
import MetricsDashboard from '../components/migration/MetricsDashboard';
import FloatingAssistant from '../components/shared/FloatingAssistant';
import LiveIndicator from '../components/shared/LiveIndicator';
import { useMigrations } from '../hooks/useMigrations';
import { useMigrationStream } from '../hooks/useMigrationStream';
import { useAutonomousMigration } from '../hooks/useAutonomousMigration';
import { executeMigration, simulateFailure, rollbackMigration } from '../api/migration';
import type { AssistantMessage } from '../components/shared/FloatingAssistant';

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
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([]);
  const msgIdRef = useRef(0);
  useMigrationStream();

  const addMessage = useCallback((msg: AssistantMessage) => {
    setAssistantMessages((prev) => [...prev, msg]);
  }, []);

  const { running: autoRunning, currentApp, elapsedSeconds, run: runAuto, abort: abortAuto } =
    useAutonomousMigration(addMessage);

  const migratedCount = Object.values(migrations).filter((m) => m.state === 'MIGRATED').length;
  const progress = (migratedCount / APPS.length) * 100;
  const allMigrated = migratedCount === APPS.length;

  const makeMsg = (text: string, type: AssistantMessage['type'] = 'info'): AssistantMessage => ({
    id: `ui-${++msgIdRef.current}-${Date.now()}`,
    text,
    type,
  });

  const migrateAll = async () => {
    setBulkRunning(true);
    addMessage(makeMsg('Bulk migration triggered — queuing all idle apps…', 'info'));
    for (const app of APPS) {
      const state = migrations[app.id]?.state ?? 'IDLE';
      if (state === 'IDLE' || state === 'ROLLED_BACK') {
        try {
          await executeMigration(app.id, app.source, app.target);
          addMessage(makeMsg(`Started migration for ${app.id}.`, 'info'));
        } catch {
          addMessage(makeMsg(`Failed to start ${app.id}.`, 'error'));
        }
        await new Promise((res) => setTimeout(res, 1500));
      }
    }
    setBulkRunning(false);
  };

  const handleSimulateFailure = async (appId: string) => {
    addMessage(makeMsg(`Injecting failure into ${appId}… rollback will be triggered automatically.`, 'warning'));
    try {
      await simulateFailure(appId);
    } catch {
      addMessage(makeMsg(`Could not inject failure into ${appId}.`, 'error'));
    }
  };

  const handleRollback = async (appId: string) => {
    addMessage(makeMsg(`Manual rollback initiated for ${appId}. Restoring topology from snapshot…`, 'warning'));
    try {
      await rollbackMigration(appId);
    } catch {
      addMessage(makeMsg(`Rollback request for ${appId} failed.`, 'error'));
    }
  };

  const handleRunAutonomous = () => {
    if (autoRunning) {
      abortAuto();
      addMessage(makeMsg('Autonomous migration sequence aborted.', 'warning'));
    } else {
      runAuto(() => migrations);
    }
  };

  // Determine which apps have an active migration for the Simulate Failure button
  const activeApps = APPS.filter(({ id }) => {
    const s = migrations[id]?.state;
    return s && ['SNAPSHOTTED', 'PROVISIONING_TARGET', 'REWIRING', 'VALIDATING'].includes(s);
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-text-secondary" />
          <h1 className="text-xl font-semibold text-text-primary">Migration Console</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <LiveIndicator />
          <div className="text-sm text-text-secondary">
            <span className="font-semibold text-text-primary">{migratedCount}</span>
            <span className="text-text-muted"> / {APPS.length} apps migrated</span>
          </div>

          {/* Simulate Failure button — shown when any migration is active */}
          <AnimatePresence>
            {activeApps.length > 0 && (
              <motion.div
                key="sim-fail"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-1.5"
              >
                {activeApps.slice(0, 2).map((app) => (
                  <button
                    key={app.id}
                    onClick={() => handleSimulateFailure(app.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-900/40 hover:bg-amber-900/60 text-amber-300 rounded-lg text-xs font-medium transition-all duration-150 active:scale-95 border border-amber-800"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    Fail {app.id}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Rollback buttons for active apps */}
          <AnimatePresence>
            {activeApps.length > 0 && (
              <motion.div
                key="rollback-btns"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-1.5"
              >
                {activeApps.slice(0, 2).map((app) => (
                  <button
                    key={app.id}
                    onClick={() => handleRollback(app.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-300 rounded-lg text-xs font-medium transition-all duration-150 active:scale-95 border border-red-800"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Roll back {app.id}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {!allMigrated && (
            <button
              onClick={migrateAll}
              disabled={bulkRunning || isLoading || autoRunning}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-blue hover:bg-accent-blue-hover text-white rounded-lg text-xs font-medium transition-all duration-150 active:scale-95 disabled:opacity-50"
            >
              <Play className="w-3 h-3" />
              {bulkRunning ? 'Migrating all…' : 'Migrate all'}
            </button>
          )}

          {/* Autonomous Migration */}
          <motion.button
            onClick={handleRunAutonomous}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border ${
              autoRunning
                ? 'bg-red-900/30 text-red-300 border-red-800 hover:bg-red-900/50'
                : 'bg-emerald-900/40 text-emerald-300 border-emerald-800 hover:bg-emerald-900/60'
            }`}
          >
            {autoRunning ? (
              <>
                <SquareX className="w-3 h-3" />
                Abort autonomous
              </>
            ) : (
              <>
                <Zap className="w-3 h-3" />
                Run Autonomous Migration
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* Autonomous run indicator */}
      <AnimatePresence>
        {autoRunning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-800 bg-emerald-900/20">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              >
                <Zap className="w-4 h-4 text-emerald-400" />
              </motion.div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-emerald-300">Autonomous migration running</div>
                <div className="text-xs text-emerald-500 mt-0.5">
                  {currentApp ? `Processing ${currentApp} — agent narrating in assistant panel` : 'Sequencing apps…'}
                </div>
              </div>
              <div className="text-xs font-mono text-emerald-400 tabular-nums">{elapsedSeconds}s</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Metrics dashboard */}
      <MetricsDashboard
        migrations={migrations}
        apps={APPS}
        autonomousRunning={autoRunning}
        elapsedSeconds={elapsedSeconds}
      />

      {/* Overall progress bar */}
      <div>
        <div className="flex justify-between text-xs text-text-muted mb-1.5">
          <span>Overall progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full h-2 bg-surface-border rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-500 to-accent-emerald rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Timeline */}
      <MigrationTimeline apps={APPS} migrations={migrations} currentAppId={currentApp} />

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
            isAutonomousTarget={autoRunning && currentApp === app.id}
          />
        ))}
      </div>

      {/* Floating assistant */}
      <FloatingAssistant messages={assistantMessages} />
    </div>
  );
}
