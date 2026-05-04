import { Check, Loader as Loader2, X } from 'lucide-react';
import type { MigrationRecord, MigrationState } from '../../types';

const STEPS: { id: MigrationState; label: string; description: string }[] = [
  { id: 'SNAPSHOTTED',         label: 'Snapshot',   description: 'Pre-migration state saved to Redis' },
  { id: 'PROVISIONING_TARGET', label: 'Provision',  description: 'New QM pod + DLQ created on OCP' },
  { id: 'REWIRING',            label: 'Rewire',     description: 'Xmit queue + remote def installed' },
  { id: 'VALIDATING',          label: 'Validate',   description: 'Message flow tests running' },
  { id: 'MIGRATED',            label: 'Migrated',   description: 'App isolated on dedicated QM' },
  { id: 'ROLLING_BACK',        label: 'Roll back',  description: 'Restoring from snapshot' },
];

const STATE_ORDER: MigrationState[] = [
  'IDLE', 'SNAPSHOTTED', 'PROVISIONING_TARGET', 'REWIRING', 'VALIDATING', 'MIGRATED',
];

type StepStatus = 'done' | 'active' | 'error' | 'pending';

function stepStatus(stepId: MigrationState, currentState: MigrationState): StepStatus {
  if (currentState === 'ROLLING_BACK' || currentState === 'ROLLED_BACK') {
    return stepId === 'ROLLING_BACK' ? 'active' : 'error';
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

  return (
    <div className="px-4 py-4">
      {STEPS.map((step, i) => {
        const status = stepStatus(step.id, state);
        return (
          <div key={step.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`
                w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-colors
                ${status === 'done'    ? 'bg-emerald-500 text-white' : ''}
                ${status === 'active'  ? 'bg-amber-400 text-white'   : ''}
                ${status === 'error'   ? 'bg-red-400 text-white'     : ''}
                ${status === 'pending' ? 'bg-slate-100 text-slate-400' : ''}
              `}>
                {status === 'done'    && <Check className="w-3 h-3" />}
                {status === 'active'  && <Loader2 className="w-3 h-3 animate-spin" />}
                {status === 'error'   && <X className="w-3 h-3" />}
                {status === 'pending' && <span>{i + 1}</span>}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-0.5 flex-1 mt-1 min-h-[16px] ${
                  status === 'done' ? 'bg-emerald-200' : 'bg-slate-100'
                }`} />
              )}
            </div>

            <div className={`pb-4 ${i === STEPS.length - 1 ? 'pb-2' : ''}`}>
              <div className={`text-sm font-medium ${
                status === 'pending' ? 'text-slate-400' : 'text-slate-800'
              }`}>
                {step.label}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">{step.description}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
