import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, CircleCheck as CheckCircle2, Circle, Loader as Loader2 } from 'lucide-react';
import { WORKSPACE_STEPS, type WorkspaceStep } from '../types';
import { useWorkspaceStore } from '../store/workspaceStore';

const STEP_ROUTES: Record<WorkspaceStep, string> = {
  'app-mapping':       '/migration-workspace',
  'source-validation': '/migration/source-validation',
  'config-redeploy':   '/migration/config-redeploy',
  'target-validation': '/migration/target-validation',
  'summary':           '/migration/summary',
};

const stepOrder: WorkspaceStep[] = [
  'app-mapping',
  'source-validation',
  'config-redeploy',
  'target-validation',
  'summary',
];

function stepIndex(step: WorkspaceStep) {
  return stepOrder.indexOf(step);
}

export default function MigrationHeader() {
  const navigate = useNavigate();
  const { currentStep, selectedAppId } = useWorkspaceStore();

  const current = stepIndex(currentStep);

  return (
    <div
      className="w-full border-b border-surface-border bg-surface-raised/80 px-6 py-4"
      style={{ backdropFilter: 'blur(12px)' }}
    >
      {/* App context bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="px-3 py-1 rounded-full text-xs font-semibold border"
            style={{
              background: 'rgba(6,182,212,0.12)',
              borderColor: 'rgba(6,182,212,0.35)',
              color: '#22d3ee',
            }}
          >
            In Progress
          </div>
          <span className="text-text-primary font-semibold text-sm">
            {selectedAppId ? selectedAppId.replace('app-', '').replace(/([a-z])([A-Z])/g, '$1 $2') : 'Payment Event Flow Migration'}
          </span>
          <span className="text-text-muted text-xs">Application: PaymentAPI</span>
          <span className="text-surface-border">|</span>
          <span className="text-text-muted text-xs">Environment: PROD</span>
          <span className="text-surface-border">|</span>
          <span className="text-text-muted text-xs">Domain: Payments</span>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5"
            style={{
              background: 'rgba(6,182,212,0.08)',
              borderColor: 'rgba(6,182,212,0.25)',
              color: '#22d3ee',
            }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Active Path: SOURCE
          </div>
          <button
            className="btn-ghost text-xs"
            onClick={() => navigate('/migration-workspace')}
          >
            Validate Source
          </button>
          <button
            className="btn-primary text-xs"
            onClick={() => {
              const nextIdx = current + 1;
              if (nextIdx < stepOrder.length) {
                const next = stepOrder[nextIdx];
                navigate(STEP_ROUTES[next]);
              }
            }}
          >
            Start Migration
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Step breadcrumb */}
      <div className="flex items-center gap-0">
        {WORKSPACE_STEPS.map((step, idx) => {
          const state: 'done' | 'active' | 'pending' =
            idx < current ? 'done' : idx === current ? 'active' : 'pending';

          return (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => navigate(STEP_ROUTES[step.id])}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  state === 'active'
                    ? 'text-[#22d3ee]'
                    : state === 'done'
                    ? 'text-text-secondary hover:text-text-primary'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
                style={
                  state === 'active'
                    ? {
                        background: 'rgba(6,182,212,0.12)',
                        border: '1px solid rgba(6,182,212,0.3)',
                      }
                    : {}
                }
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border shrink-0 ${
                    state === 'active'
                      ? 'border-cyan-400 text-cyan-400 bg-cyan-400/10'
                      : state === 'done'
                      ? 'border-green-500 text-green-500 bg-green-500/10'
                      : 'border-surface-muted text-text-muted'
                  }`}
                >
                  {state === 'done' ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : state === 'active' ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    >
                      <Loader2 className="w-3 h-3" />
                    </motion.div>
                  ) : (
                    step.step
                  )}
                </span>
                {step.label}
              </button>

              {idx < WORKSPACE_STEPS.length - 1 && (
                <div className="w-6 h-px bg-surface-border mx-1 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
