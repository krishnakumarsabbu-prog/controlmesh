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
        <p className="text-xs text-text-secondary">
          Attempt queue creation with non-compliant names — BCL must return 422 POLICY_VIOLATION.
        </p>
        <button
          onClick={runAll}
          disabled={running}
          className="btn-primary"
        >
          <Play className="w-3 h-3" />
          {running ? 'Running…' : 'Run tests'}
        </button>
      </div>

      <div className="space-y-2">
        {TEST_CASES.map((tc, i) => {
          const result = results.find((r) => r.caseIdx === i);
          const cssVar = result ? (result.passed ? '--accent-success' : '--accent-danger') : '--text-muted';
          return (
            <div
              key={i}
              className="rounded-lg border px-3 py-2.5"
              style={{
                borderColor: `color-mix(in srgb, var(${cssVar}) 20%, var(--surface-border))`,
                background: `color-mix(in srgb, var(${cssVar}) 6%, var(--surface-raised))`,
              }}
            >
              <div className="flex items-start gap-2">
                <div className="mt-0.5">
                  {!result ? (
                    <ShieldAlert className="w-4 h-4 text-text-muted" />
                  ) : result.passed ? (
                    <CheckCircle className="w-4 h-4" style={{ color: 'var(--accent-success)' }} />
                  ) : (
                    <XCircle className="w-4 h-4" style={{ color: 'var(--accent-danger)' }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-text-primary">{tc.label}</span>
                    <code className="text-[10px] bg-surface-muted text-text-secondary px-1.5 py-0.5 rounded font-mono">
                      {tc.payload.name}
                    </code>
                    {result && (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{
                          background: `color-mix(in srgb, var(${result.passed ? '--accent-success' : '--accent-danger'}) 15%, transparent)`,
                          color: `var(${result.passed ? '--accent-success' : '--accent-danger'})`,
                        }}
                      >
                        HTTP {result.status}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-muted mt-0.5">{tc.description}</p>
                  {result && !result.passed && (
                    <p className="text-[10px] mt-0.5 font-mono truncate" style={{ color: 'var(--accent-danger)' }}>
                      Expected {tc.expectViolation ? '422' : '200'}, got {result.status}
                    </p>
                  )}
                </div>
                <div className="text-[10px] text-text-muted shrink-0">
                  {tc.expectViolation ? 'expect 422' : 'expect 200'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {results.length === TEST_CASES.length && (
        <div
          className="rounded-lg px-3 py-2 text-xs font-semibold border"
          style={{
            background: `color-mix(in srgb, var(${results.every((r) => r.passed) ? '--accent-success' : '--accent-danger'}) 10%, var(--surface-card))`,
            borderColor: `color-mix(in srgb, var(${results.every((r) => r.passed) ? '--accent-success' : '--accent-danger'}) 30%, transparent)`,
            color: `var(${results.every((r) => r.passed) ? '--accent-success' : '--accent-danger'})`,
          }}
        >
          {results.every((r) => r.passed)
            ? `All ${TEST_CASES.length} policy tests passed — BCL is enforcing guardrails`
            : `${results.filter((r) => !r.passed).length} test(s) failed — check BCL policy engine`}
        </div>
      )}
    </div>
  );
}
