import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader as Loader2, X, RotateCcw } from 'lucide-react';
import type { MigrationRecord, MigrationState } from '../../types';

const FORWARD_STEPS: { id: MigrationState; label: string; description: string }[] = [
  { id: 'SNAPSHOTTED',         label: 'Snapshot',   description: 'Pre-migration state saved to Redis' },
  { id: 'PROVISIONING_TARGET', label: 'Provision',  description: 'New QM pod + DLQ created on OCP' },
  { id: 'REWIRING',            label: 'Rewire',     description: 'Xmit queue + remote def installed' },
  { id: 'VALIDATING',          label: 'Validate',   description: 'Message flow tests running' },
  { id: 'MIGRATED',            label: 'Migrated',   description: 'App isolated on dedicated QM' },
];

const STATE_ORDER: MigrationState[] = [
  'IDLE', 'SNAPSHOTTED', 'PROVISIONING_TARGET', 'REWIRING', 'VALIDATING', 'MIGRATED',
];

type StepStatus = 'done' | 'active' | 'error' | 'pending';

function stepStatus(stepId: MigrationState, currentState: MigrationState): StepStatus {
  if (currentState === 'ROLLING_BACK' || currentState === 'ROLLED_BACK') {
    return 'error';
  }
  const currentIdx = STATE_ORDER.indexOf(currentState);
  const stepIdx = STATE_ORDER.indexOf(stepId);
  if (stepIdx < 0) return 'pending';
  if (stepIdx < currentIdx) return 'done';
  if (stepIdx === currentIdx) return 'active';
  return 'pending';
}

export default function MigrationStepper({ record }: { record?: MigrationRecord }) {
  const state = record?.state ?? 'IDLE';
  const isRollingBack = state === 'ROLLING_BACK';
  const isRolledBack = state === 'ROLLED_BACK';
  const showRollbackState = isRollingBack || isRolledBack;

  return (
    <div className="px-4 py-4">
      {/* Rollback header */}
      <AnimatePresence>
        {showRollbackState && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-3"
          >
            <div className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs font-medium ${
              isRollingBack
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-orange-50 border-orange-200 text-orange-700'
            }`}>
              <motion.div
                animate={isRollingBack ? { rotate: -360 } : { rotate: 0 }}
                transition={isRollingBack ? { duration: 2, repeat: Infinity, ease: 'linear' } : {}}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </motion.div>
              {isRollingBack ? 'Rolling back — restoring from pre-migration snapshot…' : 'Rolled back — source topology restored'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {FORWARD_STEPS.map((step, i) => {
        const status = stepStatus(step.id, state);
        return (
          <motion.div
            key={step.id}
            layout
            className="flex gap-3"
            animate={showRollbackState && status === 'error' ? { opacity: 0.5 } : { opacity: 1 }}
            transition={{ duration: 0.4, delay: showRollbackState ? (FORWARD_STEPS.length - 1 - i) * 0.08 : 0 }}
          >
            <div className="flex flex-col items-center">
              <motion.div
                className={`
                  w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-colors duration-300
                  ${status === 'done'    ? 'bg-emerald-500 text-white' : ''}
                  ${status === 'active'  ? 'bg-amber-400 text-white'   : ''}
                  ${status === 'error'   ? 'bg-red-400 text-white'     : ''}
                  ${status === 'pending' ? 'bg-slate-100 text-slate-400' : ''}
                `}
                animate={status === 'error' && isRollingBack ? { scale: [1, 0.9, 1] } : { scale: 1 }}
                transition={status === 'error' && isRollingBack ? { duration: 0.6, delay: (FORWARD_STEPS.length - 1 - i) * 0.15, ease: 'easeInOut' } : {}}
              >
                {status === 'done'    && <Check className="w-3 h-3" />}
                {status === 'active'  && <Loader2 className="w-3 h-3 animate-spin" />}
                {status === 'error'   && <X className="w-3 h-3" />}
                {status === 'pending' && <span>{i + 1}</span>}
              </motion.div>
              {i < FORWARD_STEPS.length - 1 && (
                <div className={`w-0.5 flex-1 mt-1 min-h-[16px] transition-colors duration-500 ${
                  status === 'done' && !showRollbackState ? 'bg-emerald-200' :
                  showRollbackState ? 'bg-red-100' :
                  'bg-slate-100'
                }`} />
              )}
            </div>

            <div className={`pb-4 ${i === FORWARD_STEPS.length - 1 ? 'pb-2' : ''}`}>
              <div className={`text-sm font-medium transition-colors duration-300 ${
                status === 'pending' ? 'text-slate-400' :
                showRollbackState && status === 'error' ? 'text-red-500 line-through decoration-red-300' :
                'text-slate-800'
              }`}>
                {step.label}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">{step.description}</div>
            </div>
          </motion.div>
        );
      })}

      {/* Rollback terminal step */}
      <AnimatePresence>
        {showRollbackState && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ delay: 0.3 }}
            className="flex gap-3 mt-1"
          >
            <div className="flex flex-col items-center">
              <motion.div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold ${
                  isRolledBack ? 'bg-orange-500 text-white' : 'bg-red-400 text-white'
                }`}
                animate={isRollingBack ? { scale: [1, 1.1, 1] } : { scale: 1 }}
                transition={isRollingBack ? { duration: 1, repeat: Infinity } : {}}
              >
                {isRolledBack ? <Check className="w-3 h-3" /> : <Loader2 className="w-3 h-3 animate-spin" />}
              </motion.div>
            </div>
            <div className="pb-2">
              <div className={`text-sm font-medium ${isRolledBack ? 'text-orange-700' : 'text-red-700'}`}>
                {isRolledBack ? 'Rolled back' : 'Rolling back…'}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {isRolledBack ? 'Source topology verified, artefacts removed' : 'Restoring from pre-migration snapshot'}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
