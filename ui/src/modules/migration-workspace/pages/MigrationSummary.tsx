import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CircleCheck as CheckCircle2, Download, RotateCcw, Circle as XCircle, FileText, Clock, Activity, Gauge, Zap, Timer, TriangleAlert as AlertTriangle, ChevronRight, Terminal } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import MigrationHeader from '../components/MigrationHeader';
import { useWorkspaceStore } from '../store/workspaceStore';
import type { RuntimeLogEntry } from '../types';

// ─── Step data ───────────────────────────────────────────────────────────────

const MIGRATION_STEPS = [
  { id: 'source-validated', label: 'Source Validated', completedAt: Date.now() - 300000 },
  { id: 'config-updated',   label: 'Config Updated',   completedAt: Date.now() - 240000 },
  { id: 'redeployed',       label: 'Redeployed',       completedAt: Date.now() - 180000 },
  { id: 'traffic-shifted',  label: 'Traffic Shifted',  completedAt: Date.now() - 90000  },
  { id: 'verified',         label: 'Verified',         completedAt: Date.now() - 30000  },
  { id: 'completed',        label: 'Completed',        completedAt: Date.now() - 5000   },
];

const LEVEL_STYLE: Record<RuntimeLogEntry['level'], { color: string; bg: string; label: string }> = {
  INFO:    { color: '#9ca3af', bg: 'transparent',             label: 'INFO' },
  WARNING: { color: '#f59e0b', bg: 'rgba(245,158,11,0.05)',   label: 'WARN' },
  ERROR:   { color: '#ef4444', bg: 'rgba(239,68,68,0.05)',    label: 'ERR ' },
  SUCCESS: { color: '#22c55e', bg: 'rgba(34,197,94,0.05)',    label: 'SUCC' },
};

// ─── Banner ──────────────────────────────────────────────────────────────────

function SummaryBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 180, damping: 20 }}
      className="rounded-2xl border p-5 flex items-center gap-5"
      style={{
        background: 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(34,197,94,0.03) 100%)',
        borderColor: 'rgba(34,197,94,0.3)',
        boxShadow: '0 0 40px rgba(34,197,94,0.08), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      <div className="relative shrink-0">
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: 'rgba(34,197,94,0.2)' }}
          animate={{ scale: [1, 1.45, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center border"
          style={{
            background: 'rgba(34,197,94,0.15)',
            borderColor: 'rgba(34,197,94,0.4)',
            boxShadow: '0 0 20px rgba(34,197,94,0.3)',
          }}
        >
          <CheckCircle2 className="w-7 h-7" style={{ color: '#22c55e' }} />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-base font-bold text-text-primary mb-0.5">Migration Completed Successfully</div>
        <div className="text-sm text-text-muted">
          PaymentAPI — PAY.QM1 → CLOUD.PAY.QM1 &nbsp;·&nbsp;
          Completed {formatDistanceToNow(Date.now() - 5000, { addSuffix: true })}
        </div>
      </div>

      <div className="flex gap-6 shrink-0">
        {[
          { label: 'Migration Completed', value: '100%',     color: '#22c55e', icon: CheckCircle2 },
          { label: 'Success Rate',        value: '99.92%',   color: '#22c55e', icon: Activity     },
          { label: 'Validated Messages',  value: '124,550',  color: '#22d3ee', icon: Gauge        },
          { label: 'Avg Latency',         value: '42 ms',    color: '#22d3ee', icon: Zap          },
          { label: 'Downtime',            value: '~12 sec',  color: '#f59e0b', icon: Timer        },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="flex flex-col items-center gap-1 min-w-[72px]">
            <Icon className="w-4 h-4" style={{ color }} />
            <div
              className="text-lg font-bold tabular-nums leading-none"
              style={{ color, textShadow: `0 0 14px ${color}60` }}
            >
              {value}
            </div>
            <div className="text-[10px] text-text-muted text-center leading-tight">{label}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Step timeline ────────────────────────────────────────────────────────────

function MigrationStepTimeline() {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="rounded-xl border p-5"
      style={{ background: 'var(--surface-card)', borderColor: 'var(--surface-border)' }}
    >
      <div className="flex items-center gap-2 mb-6">
        <Zap className="w-4 h-4 text-cyan-400" />
        <span className="section-title">Migration Timeline</span>
        <span className="ml-auto text-[11px] text-text-muted">
          Total duration: <span className="text-text-primary font-semibold">4m 55s</span>
        </span>
      </div>

      {/* Relative wrapper for the track */}
      <div className="relative pt-2 pb-10">
        {/* Background track */}
        <div
          className="absolute top-7 left-5 right-5 h-px"
          style={{ background: 'var(--surface-border)' }}
        />
        {/* Animated fill */}
        <motion.div
          className="absolute top-7 left-5 h-px"
          style={{ background: 'linear-gradient(90deg, #22c55e, #22d3ee)' }}
          initial={{ width: 0 }}
          animate={{ width: 'calc(100% - 40px)' }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
        />

        <div className="flex justify-between relative">
          {MIGRATION_STEPS.map((step, i) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="flex flex-col items-center gap-2 cursor-pointer group"
              onClick={() => setActiveIdx(activeIdx === i ? null : i)}
            >
              <motion.div
                className="w-10 h-10 rounded-full border-2 flex items-center justify-center z-10 relative"
                style={{
                  background: 'rgba(34,197,94,0.15)',
                  borderColor: '#22c55e',
                  boxShadow: activeIdx === i
                    ? '0 0 20px rgba(34,197,94,0.5)'
                    : '0 0 10px rgba(34,197,94,0.25)',
                }}
                whileHover={{ scale: 1.1 }}
              >
                <CheckCircle2 className="w-4 h-4" style={{ color: '#22c55e' }} />
              </motion.div>

              <span
                className="text-[11px] font-medium text-center leading-tight max-w-[80px] transition-colors"
                style={{ color: activeIdx === i ? '#22c55e' : 'var(--text-secondary)' }}
              >
                {step.label}
              </span>

              <AnimatePresence>
                {activeIdx === i && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.95 }}
                    className="absolute top-14 z-20 rounded-lg border px-2.5 py-1.5 whitespace-nowrap text-[11px] pointer-events-none"
                    style={{
                      background: 'var(--surface-overlay)',
                      borderColor: 'rgba(34,197,94,0.3)',
                      color: '#22c55e',
                    }}
                  >
                    <Clock className="w-3 h-3 inline mr-1 mb-0.5" />
                    {format(step.completedAt, 'HH:mm:ss')}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Metrics summary ──────────────────────────────────────────────────────────

function MetricsSummary() {
  const groups = [
    {
      title: 'Throughput',
      icon: Activity,
      color: '#22d3ee',
      items: [
        { label: 'Peak msg/min',   value: '14,820'  },
        { label: 'Avg msg/min',    value: '12,455'  },
        { label: 'Total messages', value: '124,550' },
      ],
    },
    {
      title: 'Reliability',
      icon: CheckCircle2,
      color: '#22c55e',
      items: [
        { label: 'Success rate', value: '99.92%' },
        { label: 'Error rate',   value: '0.08%'  },
        { label: 'Retries',      value: '12'     },
      ],
    },
    {
      title: 'Latency',
      icon: Gauge,
      color: '#22d3ee',
      items: [
        { label: 'P50', value: '38 ms'  },
        { label: 'P95', value: '74 ms'  },
        { label: 'P99', value: '112 ms' },
      ],
    },
    {
      title: 'Infrastructure',
      icon: Zap,
      color: '#f59e0b',
      items: [
        { label: 'Queues migrated', value: '14'    },
        { label: 'Channels',        value: '3'     },
        { label: 'Consumers up',    value: '2 / 2' },
      ],
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2 }}
      className="flex flex-col gap-3"
    >
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-cyan-400" />
        <span className="section-title">Metrics Summary</span>
      </div>

      {groups.map((group, gi) => {
        const Icon = group.icon;
        return (
          <motion.div
            key={group.title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 + gi * 0.08 }}
            className="rounded-xl border p-4"
            style={{
              background: 'var(--surface-card)',
              borderColor: `${group.color}20`,
              backgroundImage: `linear-gradient(135deg, ${group.color}06 0%, transparent 100%)`,
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Icon className="w-3.5 h-3.5" style={{ color: group.color }} />
              <span className="text-xs font-semibold" style={{ color: group.color }}>
                {group.title}
              </span>
            </div>
            <div className="space-y-1.5">
              {group.items.map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-[11px] text-text-muted">{label}</span>
                  <span className="text-[11px] font-bold tabular-nums text-text-primary">{value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

// ─── Logs panel ───────────────────────────────────────────────────────────────

function LogsPanel() {
  const { runtimeLogs } = useWorkspaceStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  const finalLogs: RuntimeLogEntry[] = [
    ...runtimeLogs,
    { timestamp: Date.now() - 15000, level: 'SUCCESS', service: 'MigrationEngine', message: 'Traffic shift completed: 100% on CLOUD.PAY.QM1' },
    { timestamp: Date.now() - 10000, level: 'SUCCESS', service: 'ValidationAgent', message: 'Post-migration validation passed — all checks green' },
    { timestamp: Date.now() - 5000,  level: 'SUCCESS', service: 'Orchestrator',    message: 'Migration completed. State → MIGRATED'            },
  ];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="rounded-xl border overflow-hidden"
      style={{ background: 'var(--surface-card)', borderColor: 'var(--surface-border)' }}
    >
      <div
        className="flex items-center gap-2 px-4 py-2.5 border-b"
        style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-overlay)' }}
      >
        <Terminal className="w-3.5 h-3.5 text-text-muted" />
        <span className="text-xs font-semibold text-text-primary">Migration Logs</span>
        <div className="flex items-center gap-1.5 ml-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
          <span className="text-[11px] text-green-400">Completed</span>
        </div>
        <span className="ml-auto text-[11px] text-text-muted">{finalLogs.length} entries</span>
      </div>

      <div
        className="h-36 overflow-y-auto"
        style={{ background: 'rgba(0,0,0,0.35)', fontFamily: "'JetBrains Mono', monospace" }}
      >
        {finalLogs.map((entry, i) => {
          const s = LEVEL_STYLE[entry.level];
          return (
            <div
              key={i}
              className="flex items-start gap-2 px-3 py-0.5 text-[11px] leading-relaxed hover:bg-white/5 transition-colors"
              style={{ background: s.bg }}
            >
              <span className="text-text-muted shrink-0 tabular-nums">{format(entry.timestamp, 'HH:mm:ss')}</span>
              <span className="shrink-0 font-semibold w-9" style={{ color: s.color }}>{s.label}</span>
              <span className="shrink-0 min-w-[120px]" style={{ color: '#67e8f9' }}>{entry.service}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{entry.message}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </motion.div>
  );
}

// ─── Action buttons ───────────────────────────────────────────────────────────

function ActionButtons({
  onRollback,
  onClose,
}: {
  onRollback: () => void;
  onClose: () => void;
}) {
  const [exporting, setExporting] = useState(false);

  const handleExport = () => {
    setExporting(true);
    setTimeout(() => setExporting(false), 1800);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="flex items-center gap-3 flex-wrap"
    >
      <button
        className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all hover:brightness-110"
        style={{
          background: 'rgba(34,211,238,0.08)',
          borderColor: 'rgba(34,211,238,0.3)',
          color: '#22d3ee',
        }}
        onClick={handleExport}
      >
        {exporting ? (
          <>
            <motion.div
              className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
            />
            Exporting…
          </>
        ) : (
          <>
            <FileText className="w-3.5 h-3.5" />
            Export Report
          </>
        )}
      </button>

      <button
        className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all hover:brightness-110"
        style={{
          background: 'rgba(34,197,94,0.08)',
          borderColor: 'rgba(34,197,94,0.25)',
          color: '#22c55e',
        }}
      >
        <Download className="w-3.5 h-3.5" />
        Download Logs
      </button>

      <button
        className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all hover:brightness-110"
        style={{
          background: 'rgba(245,158,11,0.08)',
          borderColor: 'rgba(245,158,11,0.25)',
          color: '#f59e0b',
        }}
        onClick={onRollback}
      >
        <RotateCcw className="w-3.5 h-3.5" />
        Rollback
      </button>

      <button
        className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all hover:brightness-110 ml-auto"
        style={{
          background: 'var(--surface-overlay)',
          borderColor: 'var(--surface-border)',
          color: 'var(--text-secondary)',
        }}
        onClick={onClose}
      >
        <XCircle className="w-3.5 h-3.5" />
        Close Migration
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

// ─── Rollback confirm modal ───────────────────────────────────────────────────

function RollbackConfirm({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="rounded-2xl border p-6 w-[400px]"
        style={{
          background: 'var(--surface-raised)',
          borderColor: 'rgba(245,158,11,0.35)',
          boxShadow: '0 0 40px rgba(245,158,11,0.1)',
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center border"
            style={{ background: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.35)' }}
          >
            <AlertTriangle className="w-5 h-5" style={{ color: '#f59e0b' }} />
          </div>
          <div>
            <div className="text-sm font-bold text-text-primary">Confirm Rollback</div>
            <div className="text-[11px] text-text-muted">This will revert all migration changes</div>
          </div>
        </div>
        <p className="text-xs text-text-secondary mb-5 leading-relaxed">
          Rolling back will restore traffic to PAY.QM1 (source) and decommission the target
          configuration. All migrated state will be preserved in audit logs.
        </p>
        <div className="flex gap-3">
          <button
            className="flex-1 py-2 rounded-lg border text-sm font-medium"
            style={{
              background: 'transparent',
              borderColor: 'var(--surface-border)',
              color: 'var(--text-secondary)',
            }}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="flex-1 py-2 rounded-lg border text-sm font-medium"
            style={{
              background: 'rgba(245,158,11,0.12)',
              borderColor: 'rgba(245,158,11,0.4)',
              color: '#f59e0b',
            }}
            onClick={onConfirm}
          >
            Confirm Rollback
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MigrationSummary() {
  const navigate = useNavigate();
  const { resetWorkspace } = useWorkspaceStore();
  const [showRollback, setShowRollback] = useState(false);

  const handleClose = () => {
    resetWorkspace();
    navigate('/migration-workspace');
  };

  const handleRollback = () => {
    setShowRollback(false);
    resetWorkspace();
    navigate('/migration-workspace');
  };

  return (
    <div className="flex flex-col h-full -m-6 overflow-hidden">
      <MigrationHeader />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Top: success banner */}
        <SummaryBanner />

        {/* Center + Right */}
        <div className="flex gap-5">
          {/* Center */}
          <div className="flex-1 min-w-0 space-y-5">
            <MigrationStepTimeline />
            <LogsPanel />
          </div>

          {/* Right: metrics */}
          <div className="w-56 shrink-0">
            <MetricsSummary />
          </div>
        </div>

        {/* Bottom: actions */}
        <ActionButtons onRollback={() => setShowRollback(true)} onClose={handleClose} />
      </div>

      <AnimatePresence>
        {showRollback && (
          <RollbackConfirm onCancel={() => setShowRollback(false)} onConfirm={handleRollback} />
        )}
      </AnimatePresence>
    </div>
  );
}
