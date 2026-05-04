import { Clock } from 'lucide-react';
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
}

export default function PlanTimeline({ steps }: Props) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-1.5 mb-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
        <Clock className="w-3 h-3" />
        Migration Plan — {steps.length} steps
      </div>
      <ol className="relative">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          return (
            <li key={step.step} className="flex gap-3">
              {/* Connector column */}
              <div className="flex flex-col items-center shrink-0">
                <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-slate-500">{step.step}</span>
                </div>
                {!isLast && (
                  <div className="w-px flex-1 bg-slate-100 my-1 min-h-[12px]" />
                )}
              </div>

              {/* Content */}
              <div className={`pb-4 ${isLast ? 'pb-2' : ''} min-w-0`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-800">
                    {PHASE_LABELS[step.phase] ?? step.phase}
                  </span>
                  <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                    {step.qm}
                  </span>
                  <span className="text-[10px] bg-slate-50 text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded capitalize">
                    pending
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
