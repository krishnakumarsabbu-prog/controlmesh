import { useState } from 'react';
import { RotateCcw, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle } from 'lucide-react';
import { executeMigration } from '../../api/migration';
import { useMigrations } from '../../hooks/useMigrations';
import StateBadge from '../migration/StateBadge';

export default function RollbackDemoPanel() {
  const { migrations, rollbackApp } = useMigrations();
  const [triggered, setTriggered] = useState(false);
  const [triggering, setTriggering] = useState(false);

  const app2 = migrations['APP2'];
  const state = app2?.state ?? 'IDLE';

  const triggerBrokenMigration = async () => {
    setTriggering(true);
    try {
      await executeMigration('APP2', 'QM.SRC.A', 'QM.APP2.BROKEN');
    } catch {
      // Expected — broken target
    }
    setTriggered(true);
    setTriggering(false);
  };

  const isRolledBack = state === 'ROLLED_BACK';
  const isRollingBack = state === 'ROLLING_BACK';
  const isMigrating = ['SNAPSHOTTED', 'PROVISIONING_TARGET', 'REWIRING', 'VALIDATING'].includes(state);

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-secondary">
        Trigger a migration to a non-existent target QM. The validation step will fail, triggering automatic rollback.
        APP2 returns to source — no manual intervention required.
      </p>

      <div className="rounded-lg border border-surface-border bg-surface-raised px-4 py-3 flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-primary">APP2</span>
            <StateBadge state={state} />
          </div>
          <div className="text-[11px] text-text-muted font-mono mt-0.5">
            {triggered ? 'QM.SRC.A → QM.APP2.BROKEN' : 'QM.SRC.A → (not yet triggered)'}
          </div>
          {app2?.error && (
            <div className="text-[11px] mt-1 flex items-center gap-1" style={{ color: 'var(--accent-danger)' }}>
              <AlertTriangle className="w-3 h-3 shrink-0" />
              {app2.error}
            </div>
          )}
        </div>

        <div className="flex gap-2 shrink-0">
          {!triggered && (state === 'IDLE' || state === 'ROLLED_BACK') && (
            <button
              onClick={triggerBrokenMigration}
              disabled={triggering}
              className="btn-danger"
            >
              <AlertTriangle className="w-3 h-3" />
              {triggering ? 'Triggering…' : 'Trigger broken migration'}
            </button>
          )}
          {isMigrating && (
            <button
              onClick={() => rollbackApp('APP2')}
              className="btn-warning"
            >
              <RotateCcw className="w-3 h-3" />
              Manual rollback
            </button>
          )}
        </div>
      </div>

      {isRollingBack && (
        <div
          className="rounded-lg border px-3 py-2 text-xs flex items-center gap-2"
          style={{
            background: 'color-mix(in srgb, var(--accent-warning) 10%, var(--surface-card))',
            borderColor: 'color-mix(in srgb, var(--accent-warning) 30%, transparent)',
            color: 'var(--accent-warning)',
          }}
        >
          <RotateCcw className="w-3.5 h-3.5 animate-spin shrink-0" />
          Rollback agent running — removing rewiring artefacts, restoring source queue…
        </div>
      )}

      {isRolledBack && (
        <div
          className="rounded-lg border px-3 py-2 text-xs flex items-start gap-2"
          style={{
            background: 'color-mix(in srgb, var(--accent-success) 10%, var(--surface-card))',
            borderColor: 'color-mix(in srgb, var(--accent-success) 30%, transparent)',
            color: 'var(--accent-success)',
          }}
        >
          <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Rollback complete</div>
            <div className="mt-0.5 opacity-80">
              APP2 source queue restored on QM.SRC.A. No manual intervention required.
              Verify in Audit Log — look for rollback_complete event.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
