import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import ValidationBadge from '../components/validation/ValidationBadge';
import LatencySparkline from '../components/validation/LatencySparkline';
import ValidationSimulator from '../components/validation/ValidationSimulator';
import SystemValidationPanel from '../components/validation/SystemValidationPanel';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { fetchValidationHistory } from '../api/validation';
import type { ValidationResult } from '../types';

const APPS = ['APP1', 'APP2', 'APP3', 'APP4', 'APP5', 'APP6'];
const PHASES: ValidationResult['phase'][] = ['BASELINE', 'POST_REWIRE', 'FINAL'];

const PHASE_LABELS: Record<string, string> = {
  BASELINE: 'pre-migration',
  POST_REWIRE: 'transparent route',
  FINAL: 'post-cutover',
};

export default function ValidationPage() {
  const { data: allValidation, isLoading } = useQuery({
    queryKey: ['all-validation'],
    queryFn: async () => {
      const results = await Promise.all(
        APPS.map((app) =>
          fetchValidationHistory(app)
            .then((r) => ({ app, results: r }))
            .catch(() => ({ app, results: [] as ValidationResult[] }))
        )
      );
      return Object.fromEntries(results.map((r) => [r.app, r.results]));
    },
    refetchInterval: 8000,
  });

  const totalPassed = APPS.flatMap((app) =>
    PHASES.map((phase) =>
      (allValidation?.[app] ?? []).find((r) => r.phase === phase)?.passed
    )
  ).filter(Boolean).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-text-secondary" />
          <h1 className="text-xl font-semibold text-text-primary">Validation Matrix</h1>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <LoadingSpinner size="sm" />}
          <span className="text-sm">
            <span className="font-semibold text-accent-emerald">{totalPassed}</span>
            <span className="text-text-muted"> / {APPS.length * PHASES.length} checks passed</span>
          </span>
        </div>
      </div>
      {/* System policy validation */}
      <SystemValidationPanel />

      {/* Message flow simulation */}
      <ValidationSimulator />

      {/* Matrix table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-raised border-b border-surface-border">
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider w-36">
                Application
              </th>
              {PHASES.map((phase) => (
                <th key={phase} className="px-4 py-3 text-center text-xs font-semibold text-text-muted uppercase tracking-wider">
                  <div>{phase.replace('_', ' ')}</div>
                  <div className="text-[10px] font-normal text-text-muted normal-case tracking-normal mt-0.5">
                    {PHASE_LABELS[phase]}
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 text-center text-xs font-semibold text-text-muted uppercase tracking-wider w-32">
                Latency trend
              </th>
            </tr>
          </thead>
          <tbody>
            {APPS.map((app, i) => {
              const appResults = allValidation?.[app] ?? [];
              const latencies = PHASES.map((phase) =>
                appResults.find((r) => r.phase === phase)?.latency_ms
              ).filter((v): v is number => v !== undefined);

              return (
                <tr
                  key={app}
                  className={`hover:bg-surface-overlay transition-colors ${
                    i < APPS.length - 1 ? 'border-b border-surface-border' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-text-primary text-sm">{app}</div>
                    <div className="text-[11px] text-text-muted font-mono">
                      {app.replace('APP', 'QM.APP')}
                    </div>
                  </td>
                  {PHASES.map((phase) => {
                    const result = appResults.find((r) => r.phase === phase);
                    return (
                      <td key={phase} className="px-4 py-3 text-center">
                        <ValidationBadge result={result} />
                      </td>
                    );
                  })}
                  <td className="px-4 py-3">
                    <LatencySparkline latencies={latencies} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Phase stats */}
      <div className="grid grid-cols-3 gap-4">
        {PHASES.map((phase) => {
          const values = APPS.flatMap((app) =>
            (allValidation?.[app] ?? [])
              .filter((r) => r.phase === phase)
              .map((r) => r.latency_ms)
          ).filter((v): v is number => v !== undefined);

          const avg = values.length
            ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
            : null;
          const max = values.length ? Math.max(...values) : null;

          return (
            <div key={phase} className="stat-card">
              <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                {phase.replace('_', ' ')}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-text-primary">{avg ?? '—'}</span>
                {avg !== null && <span className="text-sm text-text-muted">ms avg</span>}
              </div>
              {max !== null && (
                <div className="text-xs text-text-muted mt-1">max {max} ms</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
