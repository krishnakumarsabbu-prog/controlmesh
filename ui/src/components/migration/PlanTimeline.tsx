import { Check, Loader as Loader2, X, Clock, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import type { MigrationPlanStep } from '../../types';

const PHASE_LABELS: Record<string, string> = {
  BASELINE_VALIDATION: 'Baseline Validation',
  SNAPSHOT: 'Snapshot',
  PROVISION_TARGET: 'Provision Target QM',
  REWIRE: 'Rewire Traffic',
  POST_REWIRE_VALIDATION: 'Post-Rewire Validation',
  CUTOVER: 'Cutover',
  FINAL_VALIDATION: 'Final Validation',
};

interface Props {
  steps: MigrationPlanStep[];
  planReasoning?: string;
}

function StepReasoning({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
      >
        <Lightbulb className="w-3 h-3" />
        Why this step?
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.p
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden text-[11px] text-slate-500 italic mt-1 pl-1 border-l-2 border-slate-200 leading-relaxed"
          >
            {text}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function PlanTimeline({ steps, planReasoning }: Props) {
  const completedCount = steps.filter((s) => s.status === 'success').length;
  const progress = steps.length > 0 ? (completedCount / steps.length) * 100 : 0;
  const hasActivity = steps.some((s) => s.status !== 'pending');

  return (
    <div className="px-4 py-3">
      {/* Header + progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
            <Clock className="w-3 h-3" />
            Migration Plan — {steps.length} steps
          </div>
          {hasActivity && (
            <span className="text-xs text-slate-400">
              {completedCount}/{steps.length} done
            </span>
          )}
        </div>
        {hasActivity && (
          <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        )}
      </div>

      {/* Plan-level reasoning banner */}
      {planReasoning && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex gap-2 mb-4 px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-lg"
        >
          <Lightbulb className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 leading-relaxed">{planReasoning}</p>
        </motion.div>
      )}

      {/* Step list */}
      <ol className="relative">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          const isActive = step.status === 'running';
          const isDone = step.status === 'success';
          const isFailed = step.status === 'failed';

          return (
            <motion.li
              key={step.step}
              layout
              className="flex gap-3"
            >
              {/* Connector column */}
              <div className="flex flex-col items-center shrink-0">
                <motion.div
                  className={`
                    w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors duration-300
                    ${isDone   ? 'bg-emerald-500 border-emerald-500 text-white' : ''}
                    ${isActive ? 'bg-amber-400 border-amber-400 text-white shadow-md shadow-amber-200' : ''}
                    ${isFailed ? 'bg-red-400 border-red-400 text-white' : ''}
                    ${step.status === 'pending' ? 'bg-white border-slate-200 text-slate-400' : ''}
                  `}
                  animate={isActive ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                  transition={isActive ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : {}}
                >
                  <AnimatePresence mode="wait">
                    {isDone && (
                      <motion.span key="done" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                        <Check className="w-3 h-3" />
                      </motion.span>
                    )}
                    {isActive && (
                      <motion.span key="active" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                        <Loader2 className="w-3 h-3 animate-spin" />
                      </motion.span>
                    )}
                    {isFailed && (
                      <motion.span key="failed" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                        <X className="w-3 h-3" />
                      </motion.span>
                    )}
                    {step.status === 'pending' && (
                      <motion.span key="pending" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                        <span className="text-[10px] font-bold">{step.step}</span>
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
                {!isLast && (
                  <div className={`w-px flex-1 my-1 min-h-[12px] transition-colors duration-500 ${
                    isDone ? 'bg-emerald-200' : 'bg-slate-100'
                  }`} />
                )}
              </div>

              {/* Content */}
              <motion.div
                className={`pb-4 ${isLast ? 'pb-2' : ''} min-w-0`}
                animate={{ opacity: step.status === 'pending' ? 0.5 : 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-semibold transition-colors duration-300 ${
                    isActive ? 'text-amber-700' : isDone ? 'text-emerald-700' : 'text-slate-800'
                  }`}>
                    {PHASE_LABELS[step.phase] ?? step.phase}
                  </span>
                  <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                    {step.qm}
                  </span>
                  <motion.span
                    key={step.status}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`text-[10px] px-1.5 py-0.5 rounded border capitalize font-medium ${
                      isDone   ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                      isActive ? 'bg-amber-50 text-amber-600 border-amber-200' :
                      isFailed ? 'bg-red-50 text-red-500 border-red-200' :
                      'bg-slate-50 text-slate-400 border-slate-200'
                    }`}
                  >
                    {step.status}
                  </motion.span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  {step.description}
                </p>
                {step.reasoning && (
                  <StepReasoning text={step.reasoning} />
                )}
              </motion.div>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
