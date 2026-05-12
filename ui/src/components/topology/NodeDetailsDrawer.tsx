import { motion, AnimatePresence } from 'framer-motion';
import { X, Server, MonitorPlay, GitBranch, Database, CircleCheck as CheckCircle, Loader as Loader2, Circle as XCircle, RefreshCw, RotateCcw, Clock } from 'lucide-react';
import type { TopologyNodeData } from '../../api/topologyUpload';
import type { ProvisionedNode } from '../../hooks/useProvisionEvents';

type AnyNode = TopologyNodeData | ProvisionedNode;

interface Props {
  node: AnyNode | null;
  onClose: () => void;
  onRetry?: (nodeId: string) => void;
  onRollback?: (nodeId: string) => void;
  sourceRow?: Record<string, string>;
}

function isProvisioned(n: AnyNode): n is ProvisionedNode {
  return 'logs' in n;
}

function TypeIcon({ type }: { type: string }) {
  if (type === 'appNode') return <MonitorPlay className="w-5 h-5 text-blue-400" />;
  if (type === 'qmNode') return <Server className="w-5 h-5 text-violet-400" />;
  if (type === 'channelNode') return <GitBranch className="w-5 h-5 text-amber-400" />;
  return <Database className="w-5 h-5 text-slate-400" />;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'provisioning') {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-900/50 border border-blue-700 text-xs text-blue-300 font-medium">
        <Loader2 className="w-3 h-3 animate-spin" />
        Provisioning
      </span>
    );
  }
  if (status === 'success') {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-900/50 border border-emerald-700 text-xs text-emerald-300 font-medium">
        <CheckCircle className="w-3 h-3" />
        Provisioned
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-900/50 border border-red-700 text-xs text-red-300 font-medium">
        <XCircle className="w-3 h-3" />
        Failed
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-overlay border border-surface-border text-xs text-text-muted font-medium">
      <Clock className="w-3 h-3" />
      Pending
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-surface-border/50 last:border-0">
      <span className="text-xs text-text-muted shrink-0">{label}</span>
      <span className="text-xs text-text-primary font-mono text-right break-all">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 mb-4">
      <h3 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">{title}</h3>
      {children}
    </div>
  );
}

export default function NodeDetailsDrawer({ node, onClose, onRetry, onRollback, sourceRow }: Props) {
  const provNode = node && isProvisioned(node) ? node : null;

  return (
    <AnimatePresence>
      {node && (
        <motion.div
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          className="absolute right-0 top-0 bottom-0 w-80 bg-[#0d1520] border-l border-surface-border flex flex-col z-50 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border shrink-0">
            <div className="flex items-center gap-2">
              <TypeIcon type={node.type} />
              <div>
                <p className="text-sm font-semibold text-text-primary leading-tight truncate max-w-[170px]">
                  {node.label}
                </p>
                <p className="text-[10px] text-text-muted capitalize">{node.type.replace('Node', '')}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors p-1 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Status */}
          <div className="px-4 py-3 border-b border-surface-border shrink-0">
            <StatusBadge status={node.status || 'pending'} />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 py-3 text-sm space-y-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-border">

            {/* General Info */}
            <Section title="General Information">
              <InfoRow label="Node ID" value={node.id} />
              <InfoRow label="Node Type" value={node.type.replace('Node', '')} />
              <InfoRow label="Label" value={node.label} />
              {node.type === 'appNode' && (
                <>
                  <InfoRow label="App ID" value={(node as TopologyNodeData).app_id} />
                  <InfoRow label="App Name" value={(node as TopologyNodeData).app_name} />
                  <InfoRow label="Neighborhood" value={(node as TopologyNodeData).neighborhood} />
                  <InfoRow label="Role" value={(node as TopologyNodeData).role} />
                </>
              )}
              {node.type === 'qmNode' && (
                <>
                  <InfoRow label="Queue Manager" value={(node as TopologyNodeData).queue_manager || node.label} />
                  <InfoRow label="Role" value={(node as TopologyNodeData).role} />
                  <InfoRow label="Queue Count" value={String((node as TopologyNodeData).queues?.length || 0)} />
                </>
              )}
              {node.type === 'channelNode' && (
                <>
                  <InfoRow label="Channel Name" value={(node as TopologyNodeData).channel_name || node.label} />
                  <InfoRow label="Source QM" value={(node as TopologyNodeData).source_qm || (provNode as any)?.source_qm} />
                  <InfoRow label="Target QM" value={(node as TopologyNodeData).target_qm || (provNode as any)?.target_qm} />
                  <InfoRow label="Flow Type" value={(node as TopologyNodeData).flow_type} />
                </>
              )}
              {node.type === 'queueNode' && (
                <>
                  <InfoRow label="Queue Name" value={node.label} />
                  <InfoRow label="Queue Type" value={(provNode as any)?.queue_type || 'local'} />
                  <InfoRow label="Parent QM" value={(provNode as any)?.parent_qm} />
                </>
              )}
            </Section>

            {/* Source Row (from CSV/XLSX) */}
            {sourceRow && Object.keys(sourceRow).length > 0 && (
              <Section title="Source Information">
                <InfoRow label="Producer App ID" value={sourceRow.producer_app_id} />
                <InfoRow label="Producer App Name" value={sourceRow.producer_app_name} />
                <InfoRow label="Neighborhood" value={sourceRow.producer_neighborhood} />
                <InfoRow label="Producer QM" value={sourceRow.producer_queue_manager} />
                <InfoRow label="Producer Queue" value={sourceRow.producer_queue_name} />
              </Section>
            )}

            {sourceRow && Object.keys(sourceRow).length > 0 && (
              <Section title="Target Information">
                <InfoRow label="Consumer App ID" value={sourceRow.consumer_app_id} />
                <InfoRow label="Consumer App Name" value={sourceRow.consumer_app_name} />
                <InfoRow label="Neighborhood" value={sourceRow.consumer_neighborhood} />
                <InfoRow label="Consumer QM" value={sourceRow.consumer_queue_manager} />
                <InfoRow label="Consumer Queue" value={sourceRow.consumer_queue_name} />
              </Section>
            )}

            {/* Provisioning Status */}
            {provNode && (
              <Section title="Provisioning Steps">
                <div className="flex flex-col gap-1">
                  {[
                    { label: 'Validate', done: provNode.status !== 'pending' },
                    { label: 'Create Resource', done: provNode.status === 'success' || provNode.status === 'failed', running: provNode.status === 'provisioning' },
                    { label: 'Set Permissions', done: provNode.status === 'success' },
                    { label: 'Verify', done: provNode.status === 'success' },
                  ].map((step) => (
                    <div key={step.label} className="flex items-center gap-2 py-1">
                      {step.done && !step.running && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                      {step.running && <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />}
                      {!step.done && !step.running && <div className="w-3.5 h-3.5 rounded-full border border-surface-border" />}
                      <span className={`text-xs ${step.done ? 'text-emerald-300' : step.running ? 'text-blue-300' : 'text-text-muted'}`}>
                        {step.label}
                      </span>
                      {step.done && <span className="text-[10px] text-text-muted ml-auto">Completed</span>}
                      {step.running && <span className="text-[10px] text-blue-400 ml-auto">In Progress</span>}
                      {!step.done && !step.running && <span className="text-[10px] text-text-muted ml-auto">Pending</span>}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Timestamps */}
            {provNode?.provisioned_at && (
              <Section title="Timestamps">
                <InfoRow
                  label="Provisioned At"
                  value={new Date(provNode.provisioned_at * 1000).toLocaleString()}
                />
              </Section>
            )}

            {/* IBM MQ API Response */}
            {provNode?.mq_response && (
              <Section title="IBM MQ API Response">
                <div className="bg-surface-raised border border-surface-border rounded-lg p-2 overflow-auto max-h-32">
                  <pre className="text-[9px] font-mono text-text-muted whitespace-pre-wrap break-all">
                    {JSON.stringify(provNode.mq_response, null, 2)}
                  </pre>
                </div>
              </Section>
            )}

            {/* Logs */}
            {provNode?.logs && provNode.logs.length > 0 && (
              <Section title="Logs">
                <div className="flex flex-col gap-1 bg-surface-raised border border-surface-border rounded-lg p-2 max-h-28 overflow-y-auto">
                  {provNode.logs.map((log, i) => (
                    <p key={i} className="text-[9px] font-mono text-text-muted">{log}</p>
                  ))}
                </div>
              </Section>
            )}
          </div>

          {/* Actions */}
          {provNode && (
            <div className="flex flex-col gap-2 px-4 py-3 border-t border-surface-border shrink-0">
              {provNode.status === 'failed' && onRetry && (
                <button
                  onClick={() => onRetry(node.id)}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-900/50 border border-blue-700 text-sm text-blue-300 hover:bg-blue-900 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry
                </button>
              )}
              {(provNode.status === 'success' || provNode.status === 'failed') && onRollback && (
                <button
                  onClick={() => onRollback(node.id)}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-900/30 border border-red-700/50 text-sm text-red-400 hover:bg-red-900/50 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Rollback
                </button>
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
