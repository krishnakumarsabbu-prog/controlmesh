import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader as Loader2, X, RotateCcw, ShieldAlert, TriangleAlert as AlertTriangle } from 'lucide-react';
import type { RollbackStep, TopologySnapshot } from '../../types';

const STEP_ICONS: Record<string, React.ReactNode> = {
  'revert-routing':  <RotateCcw className="w-3 h-3" />,
  'stop-channels':   <X className="w-3 h-3" />,
  'restore-queues':  <ShieldAlert className="w-3 h-3" />,
  'delete-target':   <AlertTriangle className="w-3 h-3" />,
  'reset-state':     <Check className="w-3 h-3" />,
};

interface Props {
  steps: RollbackStep[];
  snapshot: TopologySnapshot | null;
  errorMessage?: string;
  isComplete: boolean;
}

export default function RollbackTimeline({ steps, snapshot, errorMessage, isComplete }: Props) {
  const completedCount = steps.filter((s) => s.status === 'done').length;
  const progress = steps.length > 0 ? (completedCount / steps.length) * 100 : 0;

  return (
    <div className="px-4 py-3 bg-red-50/40 border-t border-red-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <motion.div
            animate={!isComplete ? { rotate: -360 } : { rotate: 0 }}
            transition={!isComplete ? { duration: 2, repeat: Infinity, ease: 'linear' } : {}}
          >
            <RotateCcw className="w-3.5 h-3.5 text-red-500" />
          </motion.div>
          <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">
            {isComplete ? 'Rollback complete' : 'Rolling back…'}
          </span>
        </div>
        <span className="text-xs text-red-400">{completedCount}/{steps.length}</span>
      </div>

      {/* Error cause */}
      {errorMessage && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2 mb-3 px-2.5 py-2 bg-red-100 rounded-lg border border-red-200"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
          <p className="text-xs text-red-700 leading-relaxed">{errorMessage}</p>
        </motion.div>
      )}

      {/* Snapshot info */}
      {snapshot && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-1.5 mb-3 text-[11px] text-slate-500"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
          Restoring from snapshot captured {new Date(snapshot.captured_at).toLocaleTimeString()} — {snapshot.queues.length} queues
        </motion.div>
      )}

      {/* Progress bar (reverse direction) */}
      <div className="w-full h-1 bg-red-100 rounded-full overflow-hidden mb-3">
        <motion.div
          className="h-full bg-gradient-to-r from-orange-400 to-red-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      {/* Rollback steps (displayed in reverse order to show unwinding) */}
      <ol className="relative">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          const isRunning = step.status === 'running';
          const isDone = step.status === 'done';
          const isFailed = step.status === 'failed';
          const isPending = step.status === 'pending';

          return (
            <motion.li
              key={step.id}
              layout
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: isPending ? 0.45 : 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="flex gap-3"
            >
              {/* Connector column */}
              <div className="flex flex-col items-center shrink-0">
                <motion.div
                  className={`
                    w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors duration-300
                    ${isDone    ? 'bg-orange-500 border-orange-500 text-white' : ''}
                    ${isRunning ? 'bg-red-400 border-red-400 text-white shadow-md shadow-red-200' : ''}
                    ${isFailed  ? 'bg-red-600 border-red-600 text-white' : ''}
                    ${isPending ? 'bg-white border-red-100 text-red-300' : ''}
                  `}
                  animate={isRunning ? { scale: [1, 1.1, 1], boxShadow: ['0 0 0px rgba(239,68,68,0)', '0 0 8px rgba(239,68,68,0.4)', '0 0 0px rgba(239,68,68,0)'] } : { scale: 1 }}
                  transition={isRunning ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : {}}
                >
                  <AnimatePresence mode="wait">
                    {isDone && (
                      <motion.span key="done" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
                        <Check className="w-3 h-3" />
                      </motion.span>
                    )}
                    {isRunning && (
                      <motion.span key="running" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                        <Loader2 className="w-3 h-3 animate-spin" />
                      </motion.span>
                    )}
                    {isFailed && (
                      <motion.span key="failed" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                        <X className="w-3 h-3" />
                      </motion.span>
                    )}
                    {isPending && (
                      <motion.span key="pending" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                        {STEP_ICONS[step.id] ?? <span className="text-[10px] font-bold">{i + 1}</span>}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>

                {!isLast && (
                  <motion.div
                    className="w-px flex-1 my-1 min-h-[14px]"
                    style={{ backgroundColor: isDone ? '#fb923c' : '#fecaca' }}
                    animate={isRunning ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
                    transition={isRunning ? { duration: 0.8, repeat: Infinity } : {}}
                  />
                )}
              </div>

              {/* Step content */}
              <motion.div
                className={`pb-4 ${isLast ? 'pb-1' : ''} min-w-0`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-semibold transition-colors duration-300 ${
                    isRunning ? 'text-red-700' :
                    isDone    ? 'text-orange-700' :
                    isFailed  ? 'text-red-900' :
                    'text-slate-500'
                  }`}>
                    {step.label}
                  </span>
                  <AnimatePresence>
                    {isRunning && (
                      <motion.span
                        key="running-badge"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="text-[10px] px-1.5 py-0.5 rounded border bg-red-50 text-red-600 border-red-200 font-medium"
                      >
                        in progress
                      </motion.span>
                    )}
                    {isDone && (
                      <motion.span
                        key="done-badge"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-[10px] px-1.5 py-0.5 rounded border bg-orange-50 text-orange-600 border-orange-200 font-medium"
                      >
                        reverted
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  {step.description}
                </p>
              </motion.div>
            </motion.li>
          );
        })}
      </ol>

      {/* Completion banner */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="mt-3 flex items-center gap-2 px-3 py-2.5 bg-orange-50 rounded-lg border border-orange-200"
          >
            <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
              <Check className="w-3 h-3 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-orange-800">Topology restored</p>
              <p className="text-[11px] text-orange-600 mt-0.5">Source QM verified operational. All artefacts removed.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
