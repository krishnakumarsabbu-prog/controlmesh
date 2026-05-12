import { useCallback, useEffect, useMemo, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  MarkerType,
  Handle,
  Position,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import { Server, MonitorPlay, GitBranch, Database, CircleCheck as CheckCircle, Loader as Loader2, Circle as XCircle } from 'lucide-react';
import type { TopologyNodeData } from '../../api/topologyUpload';
import type { ProvisionedNode } from '../../hooks/useProvisionEvents';
import type { ProvisionEvent } from '../../api/topologyUpload';

// ── Animated Provision Node Components ───────────────────────────────────────

type ProvNodeData = ProvisionedNode & { onClick?: () => void };

function ProvAppNode({ data }: { data: ProvNodeData }) {
  const isProducer = data.role === 'producer' || data.type === 'appNode';
  const isProv = data.status === 'provisioning';
  const isDone = data.status === 'success';
  const isFailed = data.status === 'failed';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      onClick={data.onClick}
      className={`relative flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border-2 shadow-lg min-w-[110px] cursor-pointer transition-all duration-300 ${
        isProv
          ? 'border-blue-400 shadow-blue-500/40 bg-[#0a1628] animate-pulse-glow-blue'
          : isDone
          ? 'border-emerald-500 shadow-emerald-500/30 bg-[#081a0f]'
          : isFailed
          ? 'border-red-500 shadow-red-500/30 bg-[#1a0808]'
          : 'border-blue-700/50 shadow-blue-900/20 bg-[#0f1e2e]'
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
        isDone ? 'bg-emerald-900/60' : isProv ? 'bg-blue-900/60' : 'bg-blue-900/40'
      }`}>
        <MonitorPlay className={`w-4 h-4 ${isDone ? 'text-emerald-400' : isProv ? 'text-blue-300' : 'text-blue-400'}`} />
      </div>
      <span className="text-[11px] font-semibold text-text-primary leading-tight text-center max-w-[90px] truncate">
        {data.label}
      </span>
      <StatusIcon status={data.status} />
      <Handle type="source" position={Position.Right} className="!bg-blue-500 !w-2 !h-2" />
      <Handle type="target" position={Position.Left} className="!bg-blue-500 !w-2 !h-2" />
      {isProv && <ProvisioningRing />}
    </motion.div>
  );
}

function ProvQMNode({ data }: { data: ProvNodeData }) {
  const isProv = data.status === 'provisioning';
  const isDone = data.status === 'success';
  const isFailed = data.status === 'failed';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 280, damping: 20 }}
      onClick={data.onClick}
      className={`relative flex flex-col gap-2 px-3 py-2.5 rounded-xl border-2 shadow-lg min-w-[150px] cursor-pointer transition-all duration-300 ${
        isProv
          ? 'border-violet-400 shadow-violet-500/40 bg-[#130f24]'
          : isDone
          ? 'border-emerald-500 shadow-emerald-500/30 bg-[#091712]'
          : isFailed
          ? 'border-red-500 shadow-red-500/30 bg-[#1a0808]'
          : 'border-violet-700/50 bg-[#1a1228]'
      }`}
    >
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDone ? 'bg-emerald-900/60' : 'bg-violet-900/60'}`}>
          <Server className={`w-3.5 h-3.5 ${isDone ? 'text-emerald-400' : 'text-violet-400'}`} />
        </div>
        <div>
          <span className="text-[11px] font-semibold text-text-primary block leading-tight max-w-[100px] truncate">
            {data.label}
          </span>
          <span className="text-[9px] text-violet-400">Queue Manager</span>
        </div>
        <StatusIcon status={data.status} className="ml-auto" />
      </div>
      <Handle type="source" position={Position.Right} className="!bg-violet-500 !w-2 !h-2" />
      <Handle type="target" position={Position.Left} className="!bg-violet-500 !w-2 !h-2" />
      {isProv && <ProvisioningRing color="violet" />}
    </motion.div>
  );
}

function ProvChannelNode({ data }: { data: ProvNodeData }) {
  const isProv = data.status === 'provisioning';
  const isDone = data.status === 'success';
  const isFailed = data.status === 'failed';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      onClick={data.onClick}
      className={`relative flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border-2 shadow-lg min-w-[110px] cursor-pointer transition-all duration-300 ${
        isProv
          ? 'border-amber-400 shadow-amber-500/40 bg-[#1c1510]'
          : isDone
          ? 'border-emerald-500 shadow-emerald-500/30 bg-[#081a0f]'
          : isFailed
          ? 'border-red-500 shadow-red-500/30 bg-[#1a0808]'
          : 'border-amber-700/60 bg-[#1c1510]'
      }`}
    >
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDone ? 'bg-emerald-900/60' : 'bg-amber-900/60'}`}>
        <GitBranch className={`w-3.5 h-3.5 ${isDone ? 'text-emerald-400' : 'text-amber-400'}`} />
      </div>
      <span className="text-[11px] font-semibold text-text-primary max-w-[90px] truncate text-center">
        {data.label}
      </span>
      <span className="text-[9px] text-amber-400">Channel</span>
      <StatusIcon status={data.status} />
      <Handle type="source" position={Position.Right} className="!bg-amber-500 !w-2 !h-2" />
      <Handle type="target" position={Position.Left} className="!bg-amber-500 !w-2 !h-2" />
      {isProv && <ProvisioningRing color="amber" />}
    </motion.div>
  );
}

function ProvQueueNode({ data }: { data: ProvNodeData & { queue_type?: string; parent_qm?: string } }) {
  const isProv = data.status === 'provisioning';
  const isDone = data.status === 'success';
  const isFailed = data.status === 'failed';
  const qtype = data.queue_type || 'local';

  const borderClass = isDone
    ? 'border-emerald-600/60'
    : isFailed
    ? 'border-red-600/60'
    : isProv
    ? qtype === 'xmit' ? 'border-sky-500' : qtype === 'remote' ? 'border-amber-500' : 'border-slate-400'
    : qtype === 'xmit' ? 'border-sky-700/50' : qtype === 'remote' ? 'border-amber-700/50' : 'border-slate-600/50';

  const iconColor = isDone ? 'text-emerald-400' : qtype === 'xmit' ? 'text-sky-400' : qtype === 'remote' ? 'text-amber-400' : 'text-slate-400';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 350, damping: 22 }}
      onClick={data.onClick}
      className={`relative flex items-center gap-2 px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all duration-200 bg-[#141a1f] ${borderClass} ${
        isProv ? 'shadow-md' : ''
      }`}
    >
      <Database className={`w-3 h-3 ${iconColor} shrink-0`} />
      <span className="text-[10px] font-medium text-text-primary max-w-[80px] truncate">{data.label}</span>
      <span className={`text-[8px] px-1 py-0.5 rounded uppercase font-semibold ${
        isDone ? 'bg-emerald-900/50 text-emerald-300' :
        qtype === 'xmit' ? 'bg-sky-900/50 text-sky-300' :
        qtype === 'remote' ? 'bg-amber-900/50 text-amber-300' :
        'bg-slate-700/60 text-slate-300'
      }`}>
        {qtype}
      </span>
      <StatusIcon status={data.status} size="xs" />
      <Handle type="source" position={Position.Right} className="!w-1.5 !h-1.5 !bg-slate-400" />
      <Handle type="target" position={Position.Left} className="!w-1.5 !h-1.5 !bg-slate-400" />
    </motion.div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusIcon({ status, className = '', size = 'sm' }: { status: string; className?: string; size?: 'xs' | 'sm' }) {
  const sz = size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  if (status === 'provisioning') return <Loader2 className={`${sz} text-blue-400 animate-spin ${className}`} />;
  if (status === 'success') return <CheckCircle className={`${sz} text-emerald-400 ${className}`} />;
  if (status === 'failed') return <XCircle className={`${sz} text-red-400 ${className}`} />;
  return null;
}

function ProvisioningRing({ color = 'blue' }: { color?: string }) {
  const colors: Record<string, string> = {
    blue: 'border-blue-400',
    violet: 'border-violet-400',
    amber: 'border-amber-400',
  };
  return (
    <div className={`absolute inset-[-4px] rounded-xl border-2 ${colors[color] || 'border-blue-400'} opacity-60 animate-ping pointer-events-none`} />
  );
}

const PROV_NODE_TYPES: NodeTypes = {
  appNode: ProvAppNode,
  qmNode: ProvQMNode,
  channelNode: ProvChannelNode,
  queueNode: ProvQueueNode,
};

// ── Layout for Provision Board ────────────────────────────────────────────────

function buildProvisionLayout(
  nodes: Record<string, ProvisionedNode>,
  onNodeClick: (n: ProvisionedNode) => void,
): { nodes: Node[]; edges: Edge[] } {
  const nodeList = Object.values(nodes);
  if (nodeList.length === 0) return { nodes: [], edges: [] };

  const appNodes = nodeList.filter((n) => n.type === 'appNode' && (!n.role || n.role === 'producer' || n.step === 'create_app'));
  const srcQMNodes = nodeList.filter((n) => n.type === 'qmNode' && (n.step === 'create_queue_manager'));
  const queueNodes = nodeList.filter((n) => n.type === 'queueNode');
  const channelNodes = nodeList.filter((n) => n.type === 'channelNode');
  const tgtQMNodes = nodeList.filter((n) => n.type === 'qmNode' && n.step === 'create_target_queue_manager');
  const consumerAppNodes = nodeList.filter((n) => n.type === 'appNode' && n.step === 'create_consumer_app');

  const COLS = { app: 0, srcQM: 220, queue: 440, channel: 660, tgtQM: 860, consApp: 1080 };
  const ROW_GAP = 100;
  const resultNodes: Node[] = [];
  const resultEdges: Edge[] = [];
  const addedEdges = new Set<string>();

  const addEdge = (src: string, tgt: string, animated = true, color = '#334155') => {
    const key = `${src}->${tgt}`;
    if (addedEdges.has(key)) return;
    addedEdges.add(key);
    resultEdges.push({
      id: `pe_${src}_${tgt}`,
      source: src,
      target: tgt,
      animated,
      markerEnd: { type: MarkerType.ArrowClosed, color },
      style: { stroke: color, strokeWidth: 2 },
    });
  };

  appNodes.forEach((n, i) => {
    resultNodes.push({ id: n.id, type: 'appNode', position: { x: COLS.app, y: i * ROW_GAP }, data: { ...n, onClick: () => onNodeClick(n) } });
  });

  srcQMNodes.forEach((n, i) => {
    resultNodes.push({ id: n.id, type: 'qmNode', position: { x: COLS.srcQM, y: i * ROW_GAP }, data: { ...n, onClick: () => onNodeClick(n) } });
    appNodes.forEach((a) => addEdge(a.id, n.id, true, '#3b82f6'));
  });

  // Queue nodes parented to QMs
  const srcQMIds = new Set(srcQMNodes.map((n) => n.id));
  const srcQueues = queueNodes.filter((n) => {
    const parentId = `qm_${n.parent_qm}`;
    return srcQMIds.has(parentId);
  });
  srcQueues.forEach((n, i) => {
    resultNodes.push({ id: n.id, type: 'queueNode', position: { x: COLS.queue, y: i * 55 }, data: { ...n, onClick: () => onNodeClick(n) } });
    const parentId = `qm_${n.parent_qm}`;
    if (srcQMIds.has(parentId)) addEdge(parentId, n.id, false, '#475569');
  });

  channelNodes.forEach((n, i) => {
    resultNodes.push({ id: n.id, type: 'channelNode', position: { x: COLS.channel, y: i * ROW_GAP + 20 }, data: { ...n, onClick: () => onNodeClick(n) } });
    const srcQMId = `qm_${n.source_qm}`;
    if (srcQMIds.has(srcQMId)) addEdge(srcQMId, n.id, true, '#f59e0b');
  });

  tgtQMNodes.forEach((n, i) => {
    resultNodes.push({ id: n.id, type: 'qmNode', position: { x: COLS.tgtQM, y: i * ROW_GAP }, data: { ...n, onClick: () => onNodeClick(n) } });
    channelNodes.forEach((c) => {
      const tgtQMId = `qm_${c.target_qm}`;
      if (tgtQMId === n.id) addEdge(c.id, n.id, true, '#f59e0b');
    });
    if (channelNodes.length === 0) {
      srcQMNodes.forEach((s) => addEdge(s.id, n.id, true, '#8b5cf6'));
    }
  });

  const tgtQMIds = new Set(tgtQMNodes.map((n) => n.id));
  const tgtQueues = queueNodes.filter((n) => {
    const parentId = `qm_${n.parent_qm}`;
    return tgtQMIds.has(parentId);
  });
  tgtQueues.forEach((n, i) => {
    resultNodes.push({ id: n.id, type: 'queueNode', position: { x: COLS.tgtQM + 180, y: i * 55 }, data: { ...n, onClick: () => onNodeClick(n) } });
    const parentId = `qm_${n.parent_qm}`;
    if (tgtQMIds.has(parentId)) addEdge(parentId, n.id, false, '#475569');
  });

  consumerAppNodes.forEach((n, i) => {
    resultNodes.push({ id: n.id, type: 'appNode', position: { x: COLS.consApp, y: i * ROW_GAP }, data: { ...n, onClick: () => onNodeClick(n) } });
    tgtQMNodes.forEach((t) => addEdge(t.id, n.id, true, '#10b981'));
  });

  return { nodes: resultNodes, edges: resultEdges };
}

// ── Activity Log ─────────────────────────────────────────────────────────────

function ActivityLog({ events }: { events: ProvisionEvent[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [events]);

  const displayEvents = events.filter((e) => e.type !== 'start').slice(-20);

  return (
    <div className="flex items-center gap-0 overflow-hidden">
      <div className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 bg-[#0f1923] border-r border-surface-border">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Live Activity Log</span>
      </div>
      <div ref={scrollRef} className="flex items-center gap-4 overflow-x-auto px-3 py-1.5 scrollbar-hide">
        <AnimatePresence>
          {displayEvents.map((e, i) => (
            <motion.div
              key={`${e.ts}-${i}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-1.5 shrink-0"
            >
              <span className="text-[9px] text-text-muted font-mono">
                {new Date(e.ts * 1000).toLocaleTimeString()}
              </span>
              <span className={`text-[9px] font-medium ${
                e.status === 'success' ? 'text-emerald-400' :
                e.status === 'provisioning' ? 'text-blue-400' :
                e.status === 'failed' ? 'text-red-400' :
                'text-text-muted'
              }`}>
                {e.type === 'node_provisioned' ? `${e.node_type?.replace('Node', '') || ''} '${e.label}' ${e.status === 'success' ? 'created' : 'failed'}` :
                 e.type === 'node_provisioning' ? `Creating ${e.label}...` :
                 e.message || e.type}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  nodes: Record<string, ProvisionedNode>;
  events: ProvisionEvent[];
  isRunning: boolean;
  isComplete: boolean;
  onNodeClick: (node: ProvisionedNode) => void;
}

export default function ProvisionPipelineBoard({ nodes, events, isRunning, isComplete, onNodeClick }: Props) {
  const layout = useMemo(
    () => buildProvisionLayout(nodes, onNodeClick),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes]
  );

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(layout.nodes);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(layout.edges);

  useEffect(() => {
    setRfNodes(layout.nodes);
    setRfEdges(layout.edges);
  }, [layout, setRfNodes, setRfEdges]);

  const nodeCount = Object.keys(nodes).length;
  const doneCount = Object.values(nodes).filter((n) => n.status === 'success').length;
  const progress = nodeCount > 0 ? Math.round((doneCount / nodeCount) * 100) : 0;

  return (
    <div className="flex flex-col h-full border border-surface-border rounded-xl overflow-hidden bg-[#080e14]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border bg-[#0a1018] shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {isRunning && <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />}
            {isComplete && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
            {!isRunning && !isComplete && <span className="w-2 h-2 rounded-full bg-text-muted" />}
          </div>
          <span className="text-sm font-semibold text-text-primary">Live Provisioning Pipeline</span>
          {isRunning && (
            <span className="text-xs text-blue-400 font-medium">
              Provisioning in progress...
            </span>
          )}
          {isComplete && (
            <span className="text-xs text-emerald-400 font-medium">
              Completed successfully
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span>{doneCount} / {nodeCount} nodes</span>
          </div>
          {nodeCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-32 h-1.5 rounded-full bg-surface-overlay overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <span className="text-xs font-mono text-text-muted">{progress}%</span>
            </div>
          )}
          {/* Legend */}
          <div className="flex items-center gap-2">
            {[
              { color: 'bg-text-muted', label: 'Pending' },
              { color: 'bg-blue-400', label: 'Provisioning' },
              { color: 'bg-emerald-400', label: 'Provisioned' },
              { color: 'bg-red-400', label: 'Failed' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1 text-[10px] text-text-muted">
                <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 min-h-0 relative">
        {nodeCount === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-text-muted">
              <div className="w-12 h-12 rounded-full border-2 border-dashed border-surface-border flex items-center justify-center mx-auto mb-3">
                <Server className="w-5 h-5" />
              </div>
              <p className="text-sm">Waiting for provisioning events...</p>
            </div>
          </div>
        ) : (
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={PROV_NODE_TYPES}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.1}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            className="bg-transparent"
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#0f1923" />
            <Controls className="!bg-surface-card !border-surface-border" />
            <MiniMap
              className="!bg-surface-raised !border-surface-border"
              nodeColor={(n) => {
                const d = n.data as ProvisionedNode;
                if (d.status === 'success') return '#10b981';
                if (d.status === 'provisioning') return '#3b82f6';
                if (d.status === 'failed') return '#ef4444';
                return '#475569';
              }}
              maskColor="rgba(8,14,20,0.7)"
            />
          </ReactFlow>
        )}
      </div>

      {/* Activity Log Footer */}
      <div className="border-t border-surface-border bg-[#0a1018] shrink-0 h-9 overflow-hidden">
        <ActivityLog events={events} />
      </div>
    </div>
  );
}
