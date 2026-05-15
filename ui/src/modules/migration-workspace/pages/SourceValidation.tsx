import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import MigrationHeader from '../components/MigrationHeader';
import ValidationConsole from '../components/ValidationConsole';
import LiveMetricsPanel from '../components/LiveMetricsPanel';
import WorkspaceMigrationTimeline from '../components/WorkspaceMigrationTimeline';
import RuntimeConsole from '../components/RuntimeConsole';
import { useWorkspaceStore } from '../store/workspaceStore';

export default function SourceValidation() {
  const navigate = useNavigate();
  const { setStep } = useWorkspaceStore();

  const proceed = () => {
    setStep('config-redeploy');
    navigate('/migration/config-redeploy');
  };

  return (
    <div className="flex flex-col h-full -m-6 overflow-hidden">
      <MigrationHeader />

      <div className="flex flex-1 overflow-hidden">
        {/* Left — validation checks */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-[380px] shrink-0 border-r border-surface-border flex flex-col p-4 overflow-hidden"
          style={{ background: 'var(--surface-raised)' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-4 h-4" style={{ color: '#22d3ee' }} />
            <h3 className="text-sm font-semibold text-text-primary">Source Validation</h3>
          </div>
          <div className="flex-1 overflow-hidden">
            <ValidationConsole />
          </div>

          <div className="mt-4 pt-4 border-t border-surface-border flex gap-2">
            <button className="btn-ghost flex-1 text-xs justify-center" onClick={() => navigate('/migration-workspace')}>
              Back
            </button>
            <button className="btn-primary flex-1 text-xs justify-center" onClick={proceed}>
              Proceed to Config
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>

        {/* Center — runtime console */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-surface-border">
            <span className="text-xs font-semibold text-text-primary">3. Live Flow &amp; Response</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <RuntimeConsole />
          </div>
        </div>

        {/* Right — timeline + metrics */}
        <motion.aside
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-[260px] shrink-0 border-l border-surface-border overflow-y-auto"
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
