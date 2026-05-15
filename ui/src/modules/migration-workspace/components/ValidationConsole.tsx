import { motion, AnimatePresence } from 'framer-motion';
import { CircleCheck as CheckCircle2, Circle as XCircle, TriangleAlert as AlertTriangle, Loader as Loader2, Circle } from 'lucide-react';
import { useWorkspaceStore } from '../store/workspaceStore';
import type { ValidationCheckResult } from '../types';

const STATUS_ICON = {
  pending: <Circle className="w-3.5 h-3.5 text-text-muted" />,
  running: <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />,
  passed:  <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />,
  failed:  <XCircle className="w-3.5 h-3.5 text-red-400" />,
  warning: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
};

const STATUS_COLOR = {
  pending: 'text-text-muted',
  running: 'text-cyan-300',
  passed:  'text-green-300',
  failed:  'text-red-300',
  warning: 'text-amber-300',
};

function CheckRow({ check }: { check: ValidationCheckResult }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-2.5 py-1.5 px-3 rounded-lg hover:bg-surface-overlay/40 transition-colors"
    >
      <span className="shrink-0">{STATUS_ICON[check.status]}</span>
      <span className={`text-xs font-medium flex-1 ${STATUS_COLOR[check.status]}`}>{check.label}</span>
      {check.detail && (
        <span className="text-[11px] text-text-muted truncate max-w-[160px]">{check.detail}</span>
      )}
      {check.latency !== undefined && check.latency > 0 && (
        <span className="text-[11px] font-mono text-text-muted shrink-0">{check.latency}ms</span>
      )}
    </motion.div>
  );
}

export default function ValidationConsole() {
  const { validationPhases } = useWorkspaceStore();

  const totalChecks = validationPhases.flatMap(p => p.checks).length;
  const passed = validationPhases.flatMap(p => p.checks).filter(c => c.status === 'passed').length;
  const warnings = validationPhases.flatMap(p => p.checks).filter(c => c.status === 'warning').length;
  const failed = validationPhases.flatMap(p => p.checks).filter(c => c.status === 'failed').length;

  return (
    <div className="flex flex-col h-full">
      {/* Summary bar */}
      <div className="flex items-center gap-3 mb-3 px-1">
        <span className="text-xs font-semibold text-text-primary">Validation Checks</span>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[11px] text-green-400">{passed} passed</span>
          {warnings > 0 && <span className="text-[11px] text-amber-400">{warnings} warnings</span>}
          {failed > 0 && <span className="text-[11px] text-red-400">{failed} failed</span>}
          <span className="text-[11px] text-text-muted">/ {totalChecks}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-surface-border mb-3 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: failed > 0 ? '#ef4444' : warnings > 0 ? '#f59e0b' : '#22c55e' }}
          initial={{ width: 0 }}
          animate={{ width: `${(passed / totalChecks) * 100}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>

      {/* Phase groups */}
      <div className="space-y-4 overflow-y-auto flex-1">
        <AnimatePresence>
          {validationPhases.map((phase, pi) => (
            <motion.div
              key={phase.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: pi * 0.1 }}
            >
              <div className="section-title mb-2 px-3">{phase.label}</div>
              <div
                className="rounded-xl border overflow-hidden"
                style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-overlay)' }}
              >
                {phase.checks.map((check) => (
                  <CheckRow key={check.id} check={check} />
                ))}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
