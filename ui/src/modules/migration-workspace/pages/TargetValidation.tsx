import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Target, ArrowRight, ArrowLeft } from 'lucide-react';
import MigrationHeader from '../components/MigrationHeader';
import ValidationConsole from '../components/ValidationConsole';
import MigrationFlowCanvas from '../components/MigrationFlowCanvas';
import LiveMetricsPanel from '../components/LiveMetricsPanel';
import WorkspaceMigrationTimeline from '../components/WorkspaceMigrationTimeline';
import { useWorkspaceStore } from '../store/workspaceStore';

export default function TargetValidation() {
  const navigate = useNavigate();
  const { setStep, addTimelineEvent } = useWorkspaceStore();

  const proceed = () => {
    setStep('summary');
    addTimelineEvent({ type: 'success', title: 'Target Validation Passed', detail: 'Target QM connectivity and flow validated', step: 'target-validation' });
    navigate('/migration/summary');
  };

  return (
    <div className="flex flex-col h-full -m-6 overflow-hidden">
      <MigrationHeader />

      <div className="flex flex-1 overflow-hidden">
        {/* Left — validation panel */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-[360px] shrink-0 border-r border-surface-border flex flex-col p-4 overflow-hidden"
          style={{ background: 'var(--surface-raised)' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4" style={{ color: '#c084fc' }} />
            <h3 className="text-sm font-semibold text-text-primary">Target Validation</h3>
            <div
              className="ml-auto px-2 py-0.5 rounded-full text-[11px] border font-medium"
              style={{ background: 'rgba(168,85,247,0.1)', borderColor: 'rgba(168,85,247,0.3)', color: '#c084fc' }}
            >
              CLOUD.PAY.QM1
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <ValidationConsole />
          </div>

          <div className="mt-4 pt-4 border-t border-surface-border flex gap-2">
            <button className="btn-ghost flex-1 text-xs justify-center" onClick={() => navigate('/migration/config-redeploy')}>
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
            <button className="btn-primary flex-1 text-xs justify-center" onClick={proceed}>
              View Summary
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>

        {/* Center — target topology canvas */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-border">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-text-primary">Target Topology Preview</span>
              <div
                className="px-2 py-0.5 rounded-full text-[11px] border"
                style={{ background: 'rgba(168,85,247,0.08)', borderColor: 'rgba(168,85,247,0.3)', color: '#c084fc' }}
              >
                Cloud
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <MigrationFlowCanvas />
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
