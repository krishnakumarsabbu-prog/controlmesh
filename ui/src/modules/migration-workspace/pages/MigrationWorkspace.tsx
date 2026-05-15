import { motion } from 'framer-motion';
import MigrationHeader from '../components/MigrationHeader';
import ApplicationSelector from '../components/ApplicationSelector';
import MigrationFlowCanvas from '../components/MigrationFlowCanvas';
import LiveMetricsPanel from '../components/LiveMetricsPanel';
import RuntimeConsole from '../components/RuntimeConsole';
import WorkspaceMigrationTimeline from '../components/WorkspaceMigrationTimeline';
import { useWorkspaceStore } from '../store/workspaceStore';
import { Info } from 'lucide-react';

export default function MigrationWorkspace() {
  const { selectedAppId } = useWorkspaceStore();

  return (
    <div className="flex flex-col h-full -m-6 overflow-hidden">
      {/* Sticky wizard header */}
      <MigrationHeader />

      {/* Main content — 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — Application selector */}
        <motion.aside
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-[300px] shrink-0 border-r border-surface-border flex flex-col p-4 overflow-hidden"
          style={{ background: 'var(--surface-raised)' }}
        >
          <ApplicationSelector />
        </motion.aside>

        {/* Center — Flow canvas + runtime console */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Canvas area */}
          <div className="flex flex-1 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {/* Canvas header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-border">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-text-primary">2. Current Source Topology</span>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] border"
                    style={{ background: 'rgba(6,182,212,0.08)', borderColor: 'rgba(6,182,212,0.25)', color: '#22d3ee' }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    Live
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-text-muted">View:</span>
                  <select className="input text-[11px] py-0.5 w-28">
                    <option>Logical Flow</option>
                    <option>Physical</option>
                  </select>
                </div>
              </div>

              {/* Canvas */}
              <div className="flex-1 overflow-hidden">
                {selectedAppId ? (
                  <MigrationFlowCanvas />
                ) : (
                  <div className="flex items-center justify-center h-full gap-3 text-text-muted">
                    <Info className="w-4 h-4" />
                    <span className="text-sm">Select an application to view its topology</span>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Right sidebar — flow details + metrics */}
            <motion.aside
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="w-[260px] shrink-0 border-l border-surface-border flex flex-col overflow-y-auto"
              style={{ background: 'var(--surface-raised)' }}
            >
              {/* Flow Details card */}
              <div className="p-4 border-b border-surface-border">
                <div className="section-title mb-3">Flow Details</div>
                <div className="space-y-2">
                  {[
                    { label: 'Flow Name',   value: 'Payment Event Flow' },
                    { label: 'Flow ID',     value: 'FLW-1001' },
                    { label: 'Source QM',   value: 'PAY.QM1' },
                    { label: 'Target QM',   value: 'LEDGER.QM2' },
                    { label: 'Active Path', value: 'SOURCE' },
                    { label: 'Status',      value: 'Healthy' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className="text-[11px] text-text-muted">{label}</span>
                      <span
                        className="text-[11px] font-medium"
                        style={{
                          color: value === 'SOURCE' ? '#22d3ee' :
                                 value === 'Healthy' ? '#22c55e' :
                                 value.startsWith('FLW') ? '#818cf8' : 'var(--text-primary)',
                        }}
                      >
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Quick actions */}
                <div className="mt-4 space-y-2">
                  <div className="section-title mb-2">Quick Actions</div>
                  <button className="btn-ghost w-full text-xs justify-center">View Source Topology</button>
                  <button className="btn-ghost w-full text-xs justify-center">View Target Topology</button>
                  <button className="btn-ghost w-full text-xs justify-center">Export Flow</button>
                </div>
              </div>

              {/* Live Metrics */}
              <div className="p-4">
                <LiveMetricsPanel />
              </div>
            </motion.aside>
          </div>

          {/* Bottom — runtime console */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="h-48 shrink-0 border-t border-surface-border"
            style={{ background: 'var(--surface-base)' }}
          >
            <RuntimeConsole />
          </motion.div>
        </div>
      </div>

      {/* Bottom summary bar */}
      <div
        className="shrink-0 px-6 py-3 border-t border-surface-border flex items-center justify-between"
        style={{ background: 'var(--surface-raised)' }}
      >
        <div className="text-xs text-text-muted">
          <span className="font-semibold text-text-primary">Migration Summary</span>
          <span className="ml-2 text-text-muted">(Selected Flow)</span>
        </div>
        <div className="flex items-center gap-8 text-xs">
          <div>
            <div className="text-text-muted mb-0.5">Applications</div>
            <div className="font-semibold text-text-primary">2 Producers, 2 Consumers</div>
          </div>
          <div>
            <div className="text-text-muted mb-0.5">Source Topology</div>
            <div className="font-semibold" style={{ color: '#22d3ee' }}>PAY.QM1 → LEDGER.QM2</div>
          </div>
          <div>
            <div className="text-text-muted mb-0.5">Target Topology</div>
            <div className="font-semibold" style={{ color: '#c084fc' }}>CLOUD.PAY.QM1 → CLOUD.LEDGER.QM2</div>
          </div>
          <div>
            <div className="text-text-muted mb-0.5">Est. Downtime</div>
            <div className="font-semibold text-text-primary">~15 sec</div>
          </div>
          <div>
            <div className="text-text-muted mb-0.5">Migration Strategy</div>
            <div className="font-semibold text-text-primary">Blue/Green</div>
          </div>
        </div>
        <button className="btn-primary text-xs">
          Start Migration →
        </button>
      </div>
    </div>
  );
}
