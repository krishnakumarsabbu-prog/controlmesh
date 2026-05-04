import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import ValidationBadge from '../components/validation/ValidationBadge';
import LatencySparkline from '../components/validation/LatencySparkline';
import ValidationSimulator from '../components/validation/ValidationSimulator';
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
          <ShieldCheck className="w-5 h-5 text-slate-600" />
          <h1 className="text-xl font-semibold text-slate-900">Validation Matrix</h1>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <LoadingSpinner size="sm" />}
          <span className="text-sm">
            <span className="font-semibold text-emerald-600">{totalPassed}</span>
            <span className="text-slate-400"> / {APPS.length * PHASES.length} checks passed</span>
          </span>
        </div>
      </div>
      {/* Simulation panel */}
      <ValidationSimulator />


      {/* Simulation panel */}
      <ValidationSimulator />

      {/* Matrix table */}
      <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-36">
                Application
              </th>
              {PHASES.map((phase) => (
                <th key={phase} className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <div>{phase.replace('_', ' ')}</div>
                  <div className="text-[10px] font-normal text-slate-400 normal-case tracking-normal mt-0.5">
                    {PHASE_LABELS[phase]}
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">
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
                  className={`hover:bg-slate-50 transition-colors ${
                    i < APPS.length - 1 ? 'border-b border-slate-100' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-800 text-sm">{app}</div>
                    <div className="text-[11px] text-slate-400 font-mono">
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
            <div key={phase} className="rounded-xl border border-slate-200 bg-white px-4 py-4">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                {phase.replace('_', ' ')}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">{avg ?? '—'}</span>
                {avg !== null && <span className="text-sm text-slate-400">ms avg</span>}
              </div>
              {max !== null && (
                <div className="text-xs text-slate-400 mt-1">max {max} ms</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
