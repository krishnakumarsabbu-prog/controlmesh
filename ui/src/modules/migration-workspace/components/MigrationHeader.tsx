import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, CircleCheck as CheckCircle2, Loader, Activity, Clock, Zap, TrendingUp, Play, Shield } from 'lucide-react';
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
      className="w-full border-b shrink-0"
      style={{ borderColor: 'var(--surface-border)', background: 'rgba(15,21,35,0.98)', backdropFilter: 'blur(12px)' }}
    >
      {/* ── Top row: title + traffic metrics + action buttons ── */}
      <div className="flex items-center justify-between px-6 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        {/* Left: migration title + context */}
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <motion.div
                className="w-2 h-2 rounded-full"
                style={{ background: '#22d3ee' }}
                animate={{ opacity: [0.5, 1, 0.5], scale: [0.9, 1.1, 0.9] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                {selectedAppId
                  ? `${selectedAppId.replace('app-', '').replace(/([a-z])([A-Z])/g, '$1 $2')} Migration`
                  : 'Payment Event Flow Migration'}
              </span>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(6,182,212,0.12)', color: '#22d3ee', border: '1px solid rgba(6,182,212,0.3)' }}
              >
                In Progress
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
              <span>App: <span style={{ color: 'var(--text-secondary)' }}>PaymentAPI</span></span>
              <span className="opacity-40">|</span>
              <span>Env: <span style={{ color: 'var(--text-secondary)' }}>PROD</span></span>
              <span className="opacity-40">|</span>
              <span>Domain: <span style={{ color: 'var(--text-secondary)' }}>Payments</span></span>
            </div>
          </div>
        </div>

        {/* Center: live traffic metrics */}
        <div className="flex items-center gap-6">
          {[
            { icon: <Activity className="w-3 h-3" />, label: 'Traffic', value: '12,455', unit: 'msg/min', color: '#22d3ee' },
            { icon: <TrendingUp className="w-3 h-3" />, label: 'Success Rate', value: '99.92', unit: '%', color: '#22c55e' },
            { icon: <Clock className="w-3 h-3" />, label: 'Avg Latency', value: '42', unit: 'ms', color: '#22d3ee' },
            { icon: <Zap className="w-3 h-3" />, label: 'Active Path', value: 'SOURCE', unit: '', color: '#22d3ee' },
          ].map(metric => (
            <div key={metric.label} className="text-center">
              <div className="flex items-center gap-1 justify-center mb-0.5" style={{ color: metric.color }}>
                {metric.icon}
                <span className="font-bold text-sm">{metric.value}</span>
                {metric.unit && <span className="text-[10px] opacity-70">{metric.unit}</span>}
              </div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{metric.label}</div>
            </div>
          ))}
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-medium"
            style={{ background: 'rgba(6,182,212,0.08)', borderColor: 'rgba(6,182,212,0.25)', color: '#22d3ee' }}
          >
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-cyan-400"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            Active Path: SOURCE
          </div>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-medium transition-all hover:bg-white/5"
            style={{ borderColor: 'rgba(34,211,238,0.3)', color: '#22d3ee' }}
            onClick={() => navigate('/migration-workspace')}
          >
            <Shield className="w-3 h-3" />
            Validate Source
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, #0e7490, #0891b2)', color: '#fff' }}
            onClick={() => {
              const nextIdx = current + 1;
              if (nextIdx < stepOrder.length) {
                navigate(STEP_ROUTES[stepOrder[nextIdx]]);
              }
            }}
          >
            <Play className="w-3 h-3" />
            Start Migration
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* ── Step breadcrumb ── */}
      <div className="flex items-center gap-0 px-6 py-2.5">
        {WORKSPACE_STEPS.map((step, idx) => {
          const state: 'done' | 'active' | 'pending' =
            idx < current ? 'done' : idx === current ? 'active' : 'pending';

          return (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => navigate(STEP_ROUTES[step.id])}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200 ${
                  state === 'active'
                    ? ''
                    : state === 'done'
                    ? 'hover:bg-white/5'
                    : 'hover:bg-white/5'
                }`}
                style={
                  state === 'active'
                    ? { background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)', color: '#22d3ee' }
                    : state === 'done'
                    ? { color: 'var(--text-secondary)' }
                    : { color: 'var(--text-muted)' }
                }
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                  style={{
                    border: state === 'active' ? '1px solid #22d3ee' :
                            state === 'done'   ? '1px solid #22c55e' :
                            '1px solid var(--surface-muted)',
                    background: state === 'active' ? 'rgba(34,211,238,0.1)' :
                                state === 'done'   ? 'rgba(34,197,94,0.1)' :
                                'transparent',
                    color: state === 'active' ? '#22d3ee' :
                           state === 'done'   ? '#22c55e' :
                           'var(--text-muted)',
                  }}
                >
                  {state === 'done' ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : state === 'active' ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    >
                      <Loader className="w-3 h-3" />
                    </motion.div>
                  ) : (
                    step.step
                  )}
                </span>
                {step.label}
              </button>

              {idx < WORKSPACE_STEPS.length - 1 && (
                <div className="w-8 h-px mx-1 shrink-0"
                  style={{ background: idx < current ? 'rgba(34,197,94,0.3)' : 'var(--surface-border)' }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
