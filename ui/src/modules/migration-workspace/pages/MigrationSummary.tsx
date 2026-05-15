import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CircleCheck as CheckCircle2, ArrowLeft, Rocket, RotateCcw, Download } from 'lucide-react';
import MigrationHeader from '../components/MigrationHeader';
import WorkspaceMigrationTimeline from '../components/WorkspaceMigrationTimeline';
import LiveMetricsPanel from '../components/LiveMetricsPanel';
import TrafficShiftSlider from '../components/TrafficShiftSlider';
import { useWorkspaceStore } from '../store/workspaceStore';

const SUMMARY_ROWS = [
  { label: 'Application',       value: 'PaymentAPI',                               color: 'var(--text-primary)' },
  { label: 'Source QM',         value: 'PAY.QM1',                                  color: '#22d3ee' },
  { label: 'Target QM',         value: 'CLOUD.PAY.QM1',                            color: '#c084fc' },
  { label: 'Migration Strategy', value: 'Blue / Green',                            color: 'var(--text-primary)' },
  { label: 'Rollback Strategy', value: 'Automatic',                                color: '#22c55e' },
  { label: 'Est. Downtime',     value: '~15 seconds',                              color: 'var(--text-primary)' },
  { label: 'Validation Checks', value: '9 passed · 1 warning',                    color: '#f59e0b' },
  { label: 'Bridge Channels',   value: '3 to create',                              color: 'var(--text-primary)' },
  { label: 'Traffic Split',     value: '0% Target (starting)',                     color: 'var(--text-primary)' },
];

export default function MigrationSummary() {
  const navigate = useNavigate();
  const { resetWorkspace } = useWorkspaceStore();

  const startOver = () => {
    resetWorkspace();
    navigate('/migration-workspace');
  };

  return (
    <div className="flex flex-col h-full -m-6 overflow-hidden">
      <MigrationHeader />

      <div className="flex flex-1 overflow-hidden">
        {/* Left — summary panel */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-[380px] shrink-0 border-r border-surface-border flex flex-col p-4 gap-4 overflow-y-auto"
          style={{ background: 'var(--surface-raised)' }}
        >
          {/* Ready badge */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 18 }}
            className="flex items-center gap-3 p-4 rounded-xl border"
            style={{ background: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.3)' }}
          >
            <CheckCircle2 className="w-6 h-6 shrink-0" style={{ color: '#22c55e' }} />
            <div>
              <div className="text-sm font-bold" style={{ color: '#22c55e' }}>Migration Ready</div>
              <div className="text-[11px] text-text-muted mt-0.5">All pre-flight checks passed</div>
            </div>
          </motion.div>

          {/* Summary table */}
          <div className="card p-4">
            <div className="section-title mb-3">Migration Plan</div>
            <div className="space-y-2.5">
              {SUMMARY_ROWS.map(({ label, value, color }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between"
                >
                  <span className="text-xs text-text-muted">{label}</span>
                  <span className="text-xs font-semibold" style={{ color }}>{value}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Traffic shift preview */}
          <TrafficShiftSlider />

          {/* Actions */}
          <div className="space-y-2 mt-auto">
            <button className="btn-primary w-full justify-center gap-2">
              <Rocket className="w-4 h-4" />
              Start Migration
            </button>
            <div className="grid grid-cols-3 gap-2">
              <button className="btn-ghost text-xs justify-center" onClick={() => navigate('/migration/target-validation')}>
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
              <button className="btn-ghost text-xs justify-center">
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
              <button className="btn-ghost text-xs justify-center" onClick={startOver}>
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>
          </div>
        </motion.div>

        {/* Center — timeline + next steps */}
        <div className="flex-1 flex flex-col overflow-y-auto p-6 gap-5">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="section-title mb-3">What Happens Next</div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { step: 1, label: 'Snapshot & Provision', desc: 'Capture source topology and provision target QM in cloud', color: '#6366f1' },
                { step: 2, label: 'Traffic Shift',        desc: 'Gradually move traffic using Blue/Green strategy (0→10→50→100%)', color: '#22d3ee' },
                { step: 3, label: 'Cutover & Validate',   desc: 'Full cutover and final validation on target, automatic rollback on failure', color: '#22c55e' },
              ].map(({ step, label, desc, color }) => (
                <div
                  key={step}
                  className="card p-4"
                  style={{ borderColor: `${color}30` }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold mb-3"
                    style={{ background: `${color}20`, color }}
                  >
                    {step}
                  </div>
                  <div className="text-xs font-semibold text-text-primary mb-1">{label}</div>
                  <div className="text-[11px] text-text-muted leading-relaxed">{desc}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Checklist pre-flight */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="section-title mb-3">Pre-Flight Checklist</div>
            <div className="card p-4 space-y-2">
              {[
                { label: 'Source topology snapshot captured',       ok: true },
                { label: 'Target QM provisioned and reachable',     ok: true },
                { label: 'CCDT updated for target QM',              ok: true },
                { label: 'TLS certificates verified',               ok: true },
                { label: 'DLQ depth within acceptable threshold',   ok: false },
                { label: 'Rollback plan documented',                ok: true },
              ].map(({ label, ok }) => (
                <div key={label} className="flex items-center gap-3">
                  <CheckCircle2 className={`w-4 h-4 shrink-0 ${ok ? 'text-green-400' : 'text-amber-400'}`} />
                  <span className={`text-xs ${ok ? 'text-text-primary' : 'text-amber-300'}`}>{label}</span>
                  {!ok && (
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded border text-amber-300 border-amber-400/30 bg-amber-400/10">
                      Warning
                    </span>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Right sidebar */}
        <motion.aside
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-[260px] shrink-0 border-l border-surface-border overflow-y-auto"
          style={{ background: 'var(--surface-raised)' }}
        >
          <div className="p-4 border-b border-surface-border">
            <LiveMetricsPanel />
          </div>
          <div className="p-4">
            <WorkspaceMigrationTimeline />
          </div>
        </motion.aside>
      </div>
    </div>
  );
}
