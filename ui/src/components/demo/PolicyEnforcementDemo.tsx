import { useState } from 'react';
import { ShieldAlert, CircleCheck as CheckCircle, Circle as XCircle, Play } from 'lucide-react';
import { bclClient } from '../../api/client';

interface TestCase {
  label: string;
  payload: { qm: string; name: string; type: string };
  expectViolation: boolean;
  description: string;
}

const TEST_CASES: TestCase[] = [
  {
    label: 'Bad naming — underscore',
    payload: { qm: 'QM.SRC.A', name: 'bad_queue_name', type: 'LOCAL' },
    expectViolation: true,
    description: 'Queue names must follow Q.<APP>.<PURPOSE>.<TYPE> convention',
  },
  {
    label: 'Bad naming — lowercase',
    payload: { qm: 'QM.SRC.A', name: 'q.app1.request.local', type: 'LOCAL' },
    expectViolation: true,
    description: 'All MQ object names must be uppercase',
  },
  {
    label: 'Valid queue — compliant name',
    payload: { qm: 'QM.SRC.A', name: 'Q.DEMO.TEST.LOCAL', type: 'LOCAL' },
    expectViolation: false,
    description: 'Follows naming convention — BCL accepts',
  },
];

interface Result {
  caseIdx: number;
  status: number;
  body: unknown;
  passed: boolean;
}

export default function PolicyEnforcementDemo() {
  const [results, setResults] = useState<Result[]>([]);
  const [running, setRunning] = useState(false);

  const runAll = async () => {
    setRunning(true);
    setResults([]);
    for (let i = 0; i < TEST_CASES.length; i++) {
      const tc = TEST_CASES[i];
      try {
        const resp = await bclClient.post('/api/queues', tc.payload);
        const passed = !tc.expectViolation && resp.status < 300;
        setResults((prev) => [...prev, { caseIdx: i, status: resp.status, body: resp.data, passed }]);
      } catch (err: unknown) {
        const axErr = err as { response?: { status: number; data: unknown } };
        const status = axErr?.response?.status ?? 0;
        const body = axErr?.response?.data ?? String(err);
        const passed = tc.expectViolation && status === 422;
        setResults((prev) => [...prev, { caseIdx: i, status, body, passed }]);
      }
    }
    setRunning(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-slate-500">
          Attempt queue creation with non-compliant names — BCL must return 422 POLICY_VIOLATION.
        </p>
        <button
          onClick={runAll}
          disabled={running}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
        >
          <Play className="w-3 h-3" />
          {running ? 'Running…' : 'Run tests'}
        </button>
      </div>

      <div className="space-y-2">
        {TEST_CASES.map((tc, i) => {
          const result = results.find((r) => r.caseIdx === i);
          return (
            <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
              <div className="flex items-start gap-2">
                <div className="mt-0.5">
                  {!result ? (
                    <ShieldAlert className="w-4 h-4 text-slate-300" />
                  ) : result.passed ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-700">{tc.label}</span>
                    <code className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                      {tc.payload.name}
                    </code>
                    {result && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        result.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        HTTP {result.status}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">{tc.description}</p>
                  {result && !result.passed && (
                    <p className="text-[10px] text-red-500 mt-0.5 font-mono truncate">
                      Expected {tc.expectViolation ? '422' : '200'}, got {result.status}
                    </p>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 shrink-0">
                  {tc.expectViolation ? 'expect 422' : 'expect 200'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {results.length === TEST_CASES.length && (
        <div className={`rounded-lg px-3 py-2 text-xs font-semibold ${
          results.every((r) => r.passed)
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {results.every((r) => r.passed)
            ? `All ${TEST_CASES.length} policy tests passed — BCL is enforcing guardrails`
            : `${results.filter((r) => !r.passed).length} test(s) failed — check BCL policy engine`}
        </div>
      )}
    </div>
  );
}
