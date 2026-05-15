import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Settings, ArrowRight, ArrowLeft, CircleCheck as CheckCircle2, Circle } from 'lucide-react';
import MigrationHeader from '../components/MigrationHeader';
import TrafficShiftSlider from '../components/TrafficShiftSlider';
import LiveMetricsPanel from '../components/LiveMetricsPanel';
import WorkspaceMigrationTimeline from '../components/WorkspaceMigrationTimeline';
import { useWorkspaceStore } from '../store/workspaceStore';

const CONFIG_STEPS = [
  { id: 'snapshot',   label: 'Capture topology snapshot',    done: true  },
  { id: 'provision',  label: 'Provision target QM',          done: true  },
  { id: 'ccdt',       label: 'Update CCDT / client config',  done: true  },
  { id: 'channels',   label: 'Create bridge channels',       done: false },
  { id: 'dryrun',     label: 'Dry-run message probe',        done: false },
];

export default function ConfigRedeploy() {
  const navigate = useNavigate();
  const { setStep, addTimelineEvent } = useWorkspaceStore();

  const proceed = () => {
    setStep('target-validation');
    addTimelineEvent({ type: 'success', title: 'Config & Redeploy Complete', detail: 'All pre-migration config steps applied', step: 'config-redeploy' });
    navigate('/migration/target-validation');
  };

  return (
    <div className="flex flex-col h-full -m-6 overflow-hidden">
      <MigrationHeader />

      <div className="flex flex-1 overflow-hidden">
        {/* Left — config steps */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-[340px] shrink-0 border-r border-surface-border flex flex-col p-4 gap-4 overflow-y-auto"
          style={{ background: 'var(--surface-raised)' }}
        >
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4" style={{ color: '#818cf8' }} />
            <h3 className="text-sm font-semibold text-text-primary">Config &amp; Redeploy</h3>
          </div>

          {/* Checklist */}
          <div className="space-y-2">
            {CONFIG_STEPS.map((step, i) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center gap-3 p-3 rounded-xl border"
                style={{
                  background: step.done ? 'rgba(34,197,94,0.05)' : 'var(--surface-overlay)',
                  borderColor: step.done ? 'rgba(34,197,94,0.2)' : 'var(--surface-border)',
                }}
              >
                {step.done
                  ? <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: '#22c55e' }} />
                  : <Circle className="w-4 h-4 shrink-0 text-text-muted" />
                }
                <span className={`text-xs font-medium ${step.done ? 'text-text-primary' : 'text-text-muted'}`}>
                  {step.label}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Traffic shift */}
          <TrafficShiftSlider />

          {/* Actions */}
          <div className="flex gap-2 mt-auto">
            <button className="btn-ghost flex-1 text-xs justify-center" onClick={() => navigate('/migration/source-validation')}>
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
            <button className="btn-primary flex-1 text-xs justify-center" onClick={proceed}>
              Validate Target
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>

        {/* Center — config details placeholder */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-surface-border">
            <span className="text-xs font-semibold text-text-primary">Configuration Details</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="space-y-4"
            >
              {/* CCDT card */}
              <div className="card p-4">
                <div className="section-title mb-3">CCDT Client Channel Table</div>
                <div
                  className="rounded-lg p-3 font-mono text-[11px] border overflow-x-auto"
                  style={{ background: 'rgba(0,0,0,0.3)', borderColor: 'var(--surface-border)', color: '#22d3ee' }}
                >
                  <pre>{`{
  "channel": [
    {
      "name": "CLOUD.SVRCONN",
      "clientConnection": {
        "connection": [{ "host": "cloud.pay.qm1.mq.ibm.com", "port": 1414 }],
        "queueManager": "CLOUD.PAY.QM1"
      },
      "type": "clientConnection",
      "transmissionSecurity": { "cipherSpecification": "TLS_AES_256_GCM_SHA384" }
    }
  ]
}`}</pre>
                </div>
              </div>

              {/* Bridge channels card */}
              <div className="card p-4">
                <div className="section-title mb-3">Bridge Channels to Create</div>
                <div className="space-y-2">
                  {['PAY.TO.CLOUD.SND', 'CLOUD.TO.PAY.RCV', 'AUDIT.TO.CLOUD.SND'].map((ch) => (
                    <div key={ch} className="flex items-center gap-3 p-2.5 rounded-lg border" style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-overlay)' }}>
                      <Circle className="w-3.5 h-3.5 text-text-muted" />
                      <span className="text-xs font-mono text-text-primary">{ch}</span>
                      <span className="ml-auto text-[11px] text-text-muted">pending</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Right sidebar */}
        <motion.aside
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-[240px] shrink-0 border-l border-surface-border overflow-y-auto"
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
