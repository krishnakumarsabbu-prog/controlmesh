import { ShieldAlert, ShieldCheck, RefreshCw, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2 } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';

export default function SentinelDemoPanel() {
  const { status, scan, isScanning, heal, isHealing } = useSentinel();

  const issues = status?.issues || [];
  const hasIssues = issues.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="p-1.5 rounded-lg"
            style={{
              background: `color-mix(in srgb, var(${hasIssues ? '--accent-danger' : '--accent-success'}) 15%, var(--surface-card))`,
              color: `var(${hasIssues ? '--accent-danger' : '--accent-success'})`,
            }}
          >
            {hasIssues ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
          </div>
          <div>
            <div className="text-sm font-bold text-text-primary">
              {hasIssues ? `${issues.length} Drift Issues Detected` : 'Fleet in Compliance'}
            </div>
            <div className="section-title">Sentinel Monitoring Active</div>
          </div>
        </div>
        <button
          onClick={() => scan()}
          disabled={isScanning}
          className="btn-ghost"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          Scan Fleet
        </button>
      </div>

      {hasIssues ? (
        <div className="space-y-2">
          {issues.map((issue: any) => (
            <div
              key={issue.id}
              className="p-3 rounded-xl border flex items-start gap-3"
              style={{
                borderColor: 'color-mix(in srgb, var(--accent-danger) 30%, transparent)',
                background: 'color-mix(in srgb, var(--accent-danger) 8%, var(--surface-card))',
              }}
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--accent-danger)' }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-primary">{issue.qm} / {issue.object_name}</span>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase"
                    style={{
                      background: 'color-mix(in srgb, var(--accent-danger) 20%, transparent)',
                      color: 'var(--accent-danger)',
                    }}
                  >
                    {issue.severity}
                  </span>
                </div>
                <p className="text-[11px] text-text-secondary mt-0.5">{issue.issue}</p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => heal(issue.id)}
                    disabled={isHealing}
                    className="btn-danger px-2.5 py-1 text-[10px] font-bold"
                  >
                    Fix Drift
                  </button>
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={() => heal(undefined)}
            disabled={isHealing}
            className="btn-success w-full py-2 rounded-xl text-xs font-bold"
          >
            {isHealing ? 'Self-Healing in Progress...' : 'Heal All & Re-Enforce Compliance'}
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 rounded-2xl border-2 border-dashed border-surface-border bg-surface-raised">
          <CheckCircle2 className="w-8 h-8 mb-2" style={{ color: 'var(--accent-success)' }} />
          <div className="text-sm font-semibold text-text-primary">No configuration drift detected</div>
          <p className="text-[11px] text-text-muted mt-1 text-center max-w-[200px]">
            Run a scan to verify fleet integrity against enterprise standards.
          </p>
        </div>
      )}

      <div
        className="p-3 rounded-xl border"
        style={{
          background: 'color-mix(in srgb, var(--accent-warning) 8%, var(--surface-card))',
          borderColor: 'color-mix(in srgb, var(--accent-warning) 30%, transparent)',
        }}
      >
        <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--accent-warning)' }}>
          Judge's Note:
        </div>
        <p className="text-[11px] text-text-secondary leading-relaxed">
          The Sentinel mode demonstrates the BCL's ability to act as a <strong>Self-Healing OS</strong>.
          When a human makes a manual change (Drift), the agent identifies it and offers autonomous correction
          to maintain the security posture.
        </p>
      </div>
    </div>
  );
}
