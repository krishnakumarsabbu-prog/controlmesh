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
        <p className="text-xs text-slate-500">
          Confirm all 6 apps have working message flows before migration begins.
        </p>
        <button
          onClick={runAll}
          disabled={running}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
        >
          <Play className="w-3 h-3" />
          {running ? 'Validating…' : 'Run baseline'}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {VALIDATIONS.map((v) => {
          const r = results[v.app];
          return (
            <div
              key={v.app}
              className={`rounded-lg border px-3 py-2 flex items-center gap-2 transition-all ${
                r.status === 'passed' ? 'border-emerald-200 bg-emerald-50' :
                r.status === 'failed' ? 'border-red-200 bg-red-50' :
                r.status === 'running' ? 'border-amber-200 bg-amber-50' :
                'border-slate-200 bg-slate-50'
              }`}
            >
              {r.status === 'pending'  && <div className="w-4 h-4 rounded-full bg-slate-200 shrink-0" />}
              {r.status === 'running'  && <Loader className="w-4 h-4 text-amber-500 animate-spin shrink-0" />}
              {r.status === 'passed'   && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />}
              {r.status === 'failed'   && <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-700">{v.app}</div>
                <div className="text-[10px] font-mono text-slate-400 truncate">{v.qm}</div>
              </div>
              {r.latency !== undefined && (
                <span className="text-[10px] text-emerald-600 font-mono ml-auto shrink-0">{r.latency}ms</span>
              )}
            </div>
          );
        })}
      </div>

      {allDone && (
        <div className={`rounded-lg px-3 py-2 text-xs font-semibold ${
          passed === VALIDATIONS.length
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-amber-50 text-amber-700 border border-amber-200'
        }`}>
          {passed}/{VALIDATIONS.length} baseline validations passed
          {passed === VALIDATIONS.length ? ' — ready to migrate' : ' — investigate failures before proceeding'}
        </div>
      )}
    </div>
  );
}
