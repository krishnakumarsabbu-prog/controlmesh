import { useState } from 'react';
import { Play, CircleCheck as CheckCircle, Circle as XCircle, Loader } from 'lucide-react';
import { runBaselineValidation } from '../../api/demo';

const VALIDATIONS = [
  { app: 'APP1', qm: 'QM.SRC.A', queue: 'Q.APP1.REQUEST.LOCAL' },
  { app: 'APP2', qm: 'QM.SRC.A', queue: 'Q.APP2.REQUEST.LOCAL' },
  { app: 'APP3', qm: 'QM.SRC.A', queue: 'Q.APP3.REQUEST.LOCAL' },
  { app: 'APP4', qm: 'QM.SRC.B', queue: 'Q.APP4.REQUEST.LOCAL' },
  { app: 'APP5', qm: 'QM.SRC.B', queue: 'Q.APP5.REQUEST.LOCAL' },
  { app: 'APP6', qm: 'QM.SRC.B', queue: 'Q.APP6.REQUEST.LOCAL' },
];

type AppStatus = 'pending' | 'running' | 'passed' | 'failed';

interface AppResult {
  app: string;
  status: AppStatus;
  latency?: number;
  error?: string;
}

function statusVar(status: AppStatus): string {
  if (status === 'passed') return '--accent-success';
  if (status === 'failed') return '--accent-danger';
  if (status === 'running') return '--accent-warning';
  return '--surface-border';
}

export default function BaselineValidationRunner() {
  const [results, setResults] = useState<Record<string, AppResult>>(
    Object.fromEntries(VALIDATIONS.map((v) => [v.app, { app: v.app, status: 'pending' }]))
  );
  const [running, setRunning] = useState(false);

  const runAll = async () => {
    setRunning(true);
    setResults(Object.fromEntries(VALIDATIONS.map((v) => [v.app, { app: v.app, status: 'pending' }])));

    for (const v of VALIDATIONS) {
      setResults((prev) => ({ ...prev, [v.app]: { app: v.app, status: 'running' } }));
      try {
        const data = await runBaselineValidation(v.app, v.qm, v.queue);
        setResults((prev) => ({
          ...prev,
          [v.app]: {
            app: v.app,
            status: data.passed ? 'passed' : 'failed',
            latency: data.latency_ms,
          },
        }));
      } catch (err) {
        setResults((prev) => ({
          ...prev,
          [v.app]: { app: v.app, status: 'failed', error: String(err) },
        }));
      }
    }
    setRunning(false);
  };

  const passed = Object.values(results).filter((r) => r.status === 'passed').length;
  const allDone = Object.values(results).every((r) => r.status !== 'pending' && r.status !== 'running');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-secondary">
          Confirm all 6 apps have working message flows before migration begins.
        </p>
        <button
          onClick={runAll}
          disabled={running}
          className="btn-primary"
        >
          <Play className="w-3 h-3" />
          {running ? 'Validating…' : 'Run baseline'}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {VALIDATIONS.map((v) => {
          const r = results[v.app];
          const cssVar = statusVar(r.status);
          return (
            <div
              key={v.app}
              className="rounded-lg border px-3 py-2 flex items-center gap-2 transition-all"
              style={{
                borderColor: `color-mix(in srgb, var(${cssVar}) 30%, var(--surface-border))`,
                background: `color-mix(in srgb, var(${cssVar}) 8%, var(--surface-raised))`,
              }}
            >
              {r.status === 'pending' && (
                <div className="w-4 h-4 rounded-full bg-surface-muted shrink-0" />
              )}
              {r.status === 'running' && (
                <Loader className="w-4 h-4 animate-spin shrink-0" style={{ color: 'var(--accent-warning)' }} />
              )}
              {r.status === 'passed' && (
                <CheckCircle className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-success)' }} />
              )}
              {r.status === 'failed' && (
                <XCircle className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-danger)' }} />
              )}
              <div className="min-w-0">
                <div className="text-xs font-semibold text-text-primary">{v.app}</div>
                <div className="text-[10px] font-mono text-text-muted truncate">{v.qm}</div>
              </div>
              {r.latency !== undefined && (
                <span className="text-[10px] font-mono ml-auto shrink-0" style={{ color: 'var(--accent-success)' }}>
                  {r.latency}ms
                </span>
              )}
            </div>
          );
        })}
      </div>

      {allDone && (
        <div
          className="rounded-lg px-3 py-2 text-xs font-semibold border"
          style={{
            background: `color-mix(in srgb, var(${passed === VALIDATIONS.length ? '--accent-success' : '--accent-warning'}) 10%, var(--surface-card))`,
            borderColor: `color-mix(in srgb, var(${passed === VALIDATIONS.length ? '--accent-success' : '--accent-warning'}) 30%, transparent)`,
            color: `var(${passed === VALIDATIONS.length ? '--accent-success' : '--accent-warning'})`,
          }}
        >
          {passed}/{VALIDATIONS.length} baseline validations passed
          {passed === VALIDATIONS.length ? ' — ready to migrate' : ' — investigate failures before proceeding'}
        </div>
      )}
    </div>
  );
}
