import { useState, useCallback, useRef, useEffect } from 'react';
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
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, RotateCcw, CircleCheck as CheckCircle, Circle as XCircle, TriangleAlert as AlertTriangle, ArrowRight, Server, MonitorPlay, GitBranch, Database, Zap } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { TopologyNodeData, TopologyEdgeData } from '../api/topologyUpload';

// ── Node components for simulation canvas ──────────────────────────────────

interface SimNodeData extends TopologyNodeData {
  migrated?: boolean;
  disabled?: boolean;
  success?: boolean;
  failed?: boolean;
  draggable?: boolean;
}

function SimAppNode({ data }: { data: SimNodeData }) {
  const isProducer = data.role === 'producer';
  return (
    <div
      className={`relative flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border shadow-lg min-w-[100px] transition-all duration-300 ${
        data.disabled
          ? 'opacity-40 grayscale cursor-not-allowed'
          : data.success
          ? 'bg-emerald-900/60 border-emerald-500 shadow-emerald-900/40'
          : data.failed
          ? 'bg-red-900/60 border-red-500 shadow-red-900/40'
          : isProducer
          ? 'bg-[#0f1e2e] border-blue-700/60 shadow-blue-900/30 cursor-grab active:cursor-grabbing'
          : 'bg-[#0f2214] border-emerald-700/60 shadow-emerald-900/30 cursor-grab active:cursor-grabbing'
      }`}
    >
      {data.success && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
          <CheckCircle className="w-3 h-3 text-white" />
        </div>
      )}
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
        data.success ? 'bg-emerald-700/60' : data.failed ? 'bg-red-700/60' : isProducer ? 'bg-blue-900/60' : 'bg-emerald-900/60'
      }`}>
        <MonitorPlay className={`w-4 h-4 ${data.success ? 'text-emerald-300' : data.failed ? 'text-red-300' : isProducer ? 'text-blue-400' : 'text-emerald-400'}`} />
      </div>
      <span className="text-[11px] font-semibold text-text-primary leading-tight text-center max-w-[90px] truncate">
        {data.label}
      </span>
      <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
        data.success ? 'bg-emerald-900/50 text-emerald-300' : isProducer ? 'bg-blue-900/50 text-blue-300' : 'bg-emerald-900/50 text-emerald-300'
      }`}>
        {isProducer ? 'Producer' : 'Consumer'}
      </span>
      <Handle type="source" position={Position.Right} className="!bg-blue-500 !w-2 !h-2" />
      <Handle type="target" position={Position.Left} className="!bg-emerald-500 !w-2 !h-2" />
    </div>
  );
}

function SimQMNode({ data }: { data: SimNodeData }) {
  const isSource = data.role === 'source';
  return (
    <div
      className={`relative flex flex-col gap-2 px-3 py-2.5 rounded-xl border shadow-lg min-w-[140px] transition-all duration-300 ${
        data.disabled
          ? 'opacity-40 grayscale cursor-not-allowed'
          : data.success
          ? 'bg-emerald-900/60 border-emerald-500 shadow-emerald-900/40'
          : data.failed
          ? 'bg-red-900/60 border-red-500 shadow-red-900/40'
          : isSource
          ? 'bg-[#1a1228] border-violet-700/60 shadow-violet-900/30 cursor-grab active:cursor-grabbing'
          : 'bg-[#0e1f1a] border-teal-700/60 shadow-teal-900/30 cursor-grab active:cursor-grabbing'
      }`}
    >
      {data.success && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center"
        >
          <CheckCircle className="w-3 h-3 text-white" />
        </motion.div>
      )}
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
          data.success ? 'bg-emerald-700/60' : isSource ? 'bg-violet-900/60' : 'bg-teal-900/60'
        }`}>
          <Server className={`w-3.5 h-3.5 ${data.success ? 'text-emerald-300' : isSource ? 'text-violet-400' : 'text-teal-400'}`} />
        </div>
        <span className="text-[11px] font-semibold text-text-primary block leading-tight max-w-[100px] truncate">
          {data.label}
        </span>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-violet-500 !w-2 !h-2" />
      <Handle type="target" position={Position.Left} className="!bg-violet-500 !w-2 !h-2" />
    </div>
  );
}

function SimChannelNode({ data }: { data: SimNodeData }) {
  return (
    <div
      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl border shadow-lg min-w-[100px] transition-all duration-300 ${
        data.disabled
          ? 'opacity-40 grayscale cursor-not-allowed'
          : data.success
          ? 'bg-emerald-900/40 border-emerald-600 shadow-emerald-900/30'
          : 'bg-[#1c1510] border-amber-700/60 shadow-amber-900/20 cursor-grab active:cursor-grabbing'
      }`}
    >
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${data.success ? 'bg-emerald-900/60' : 'bg-amber-900/60'}`}>
        <GitBranch className={`w-3.5 h-3.5 ${data.success ? 'text-emerald-400' : 'text-amber-400'}`} />
      </div>
      <span className="text-[11px] font-semibold text-text-primary max-w-[90px] truncate text-center">
        {data.label}
      </span>
      <Handle type="source" position={Position.Right} className="!bg-amber-500 !w-2 !h-2" />
      <Handle type="target" position={Position.Left} className="!bg-amber-500 !w-2 !h-2" />
    </div>
  );
}

function SimQueueNode({ data }: { data: SimNodeData & { queue_type?: string } }) {
  const qtype = data.queue_type || 'local';
  const successColors = { bg: 'bg-[#0d1f17]', border: 'border-emerald-600/60', text: 'text-emerald-300', badge: 'bg-emerald-900/50 text-emerald-300' };
  const disabledColors = { bg: 'bg-[#141a1f]', border: 'border-slate-700/30', text: 'text-slate-500', badge: 'bg-slate-800/50 text-slate-500' };
  const typeColors = {
    local: { bg: 'bg-[#141a1f]', border: 'border-slate-600/60', text: 'text-slate-300', badge: 'bg-slate-700/60 text-slate-300' },
    remote: { bg: 'bg-[#1c1510]', border: 'border-amber-700/50', text: 'text-amber-300', badge: 'bg-amber-900/50 text-amber-300' },
    xmit: { bg: 'bg-[#0e1820]', border: 'border-sky-700/50', text: 'text-sky-300', badge: 'bg-sky-900/50 text-sky-300' },
  };
  const colors = data.success ? successColors : data.disabled ? disabledColors : (typeColors[qtype as keyof typeof typeColors] || typeColors.local);

  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all duration-300 ${colors.bg} ${colors.border} ${
      data.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
    }`}>
      <Database className={`w-3 h-3 ${colors.text} shrink-0`} />
      <span className={`text-[10px] font-medium ${colors.text} max-w-[80px] truncate`}>{data.label}</span>
      <span className={`text-[8px] px-1 py-0.5 rounded font-semibold uppercase ${colors.badge}`}>{qtype}</span>
      <Handle type="source" position={Position.Right} className="!w-1.5 !h-1.5 !bg-slate-400" />
      <Handle type="target" position={Position.Left} className="!w-1.5 !h-1.5 !bg-slate-400" />
    </div>
  );
}

const SIM_NODE_TYPES: NodeTypes = {
  appNode: SimAppNode,
  qmNode: SimQMNode,
  channelNode: SimChannelNode,
  queueNode: SimQueueNode,
};

// ── Layout builder ─────────────────────────────────────────────────────────

function buildSimLayout(
  nodes: TopologyNodeData[],
  edges: TopologyEdgeData[],
  disabled: Set<string> = new Set(),
  success: Set<string> = new Set(),
  failed: Set<string> = new Set(),
): { nodes: Node[]; edges: Edge[] } {
  const COLS = { producerApp: 0, sourceQM: 240, channel: 480, targetQM: 680, consumerApp: 900 };
  const ROW_GAP = 110;
  const QM_GAP = 160;

  const producers = nodes.filter((n) => n.type === 'appNode' && n.role === 'producer');
  const sourceQMs = nodes.filter((n) => n.type === 'qmNode' && n.role === 'source');
  const channels = nodes.filter((n) => n.type === 'channelNode');
  const targetQMs = nodes.filter((n) => n.type === 'qmNode' && n.role === 'target');
  const consumers = nodes.filter((n) => n.type === 'appNode' && n.role === 'consumer');

  const dedup = <T extends { id: string }>(arr: T[]) => Array.from(new Map(arr.map((n) => [n.id, n])).values());

  const rfNodes: Node[] = [];

  dedup(producers).forEach((n, i) => rfNodes.push({
    id: n.id, type: 'appNode',
    position: { x: COLS.producerApp, y: i * ROW_GAP + 20 },
    data: { ...n, disabled: disabled.has(n.id), success: success.has(n.id), failed: failed.has(n.id) },
    draggable: !disabled.has(n.id),
  }));

  let srcY = 0;
  dedup(sourceQMs).forEach((n) => {
    rfNodes.push({
      id: n.id, type: 'qmNode',
      position: { x: COLS.sourceQM, y: srcY },
      data: { ...n, disabled: disabled.has(n.id), success: success.has(n.id), failed: failed.has(n.id) },
      draggable: !disabled.has(n.id),
    });
    srcY += Math.max(QM_GAP, 80 + (n.queues?.length || 0) * 35);
  });

  dedup(channels).forEach((n, i) => rfNodes.push({
    id: n.id, type: 'channelNode',
    position: { x: COLS.channel, y: i * 90 + 30 },
    data: { ...n, disabled: disabled.has(n.id), success: success.has(n.id), failed: failed.has(n.id) },
    draggable: !disabled.has(n.id),
  }));

  let tgtY = 0;
  dedup(targetQMs).forEach((n) => {
    rfNodes.push({
      id: n.id, type: 'qmNode',
      position: { x: COLS.targetQM, y: tgtY },
      data: { ...n, disabled: disabled.has(n.id), success: success.has(n.id), failed: failed.has(n.id) },
      draggable: !disabled.has(n.id),
    });
    tgtY += Math.max(QM_GAP, 80 + (n.queues?.length || 0) * 35);
  });

  dedup(consumers).forEach((n, i) => rfNodes.push({
    id: n.id, type: 'appNode',
    position: { x: COLS.consumerApp, y: i * ROW_GAP + 20 },
    data: { ...n, disabled: disabled.has(n.id), success: success.has(n.id), failed: failed.has(n.id) },
    draggable: !disabled.has(n.id),
  }));

  const rfEdges: Edge[] = edges.map((e) => ({
    id: e.id, source: e.source, target: e.target,
    label: e.label || undefined,
    labelStyle: { fontSize: 9, fill: '#94a3b8' },
    labelBgStyle: { fill: '#1e293b', fillOpacity: 0.8 },
    animated: success.has(e.source) && success.has(e.target),
    markerEnd: { type: MarkerType.ArrowClosed, color: success.has(e.source) ? '#10b981' : e.type === 'channel' ? '#f59e0b' : '#475569' },
    style: {
      stroke: success.has(e.source) ? '#10b981' : e.type === 'channel' ? '#b45309' : '#334155',
      strokeWidth: e.type === 'channel' ? 2 : 1.5,
      opacity: disabled.has(e.source) || disabled.has(e.target) ? 0.3 : 1,
    },
  }));

  return { nodes: rfNodes, edges: rfEdges };
}

// ── Drop Zone Canvas (Target) ──────────────────────────────────────────────

interface TargetCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onDrop: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
  isEmpty: boolean;
}

function TargetCanvas({ nodes, edges, onDrop, onDragOver, isEmpty }: TargetCanvasProps) {
  const [rfNodes, , onNodesChange] = useNodesState(nodes);
  const [rfEdges, , onEdgesChange] = useEdgesState(edges);

  // Sync external nodes/edges changes
  const rfNodesRef = useRef(nodes);
  const [syncedNodes, setSyncedNodes] = useNodesState(nodes);
  const [syncedEdges, setSyncedEdges] = useEdgesState(edges);

  useEffect(() => {
    setSyncedNodes(nodes);
  }, [nodes, setSyncedNodes]);

  useEffect(() => {
    setSyncedEdges(edges);
  }, [edges, setSyncedEdges]);

  return (
    <div
      className={`w-full h-full relative transition-all duration-300 ${
        isEmpty ? 'border-2 border-dashed border-emerald-700/40' : ''
      }`}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      {isEmpty && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none z-10">
          <div className="w-16 h-16 rounded-2xl bg-emerald-900/20 border border-emerald-700/30 flex items-center justify-center">
            <ArrowRight className="w-8 h-8 text-emerald-600" />
          </div>
          <p className="text-sm text-emerald-600 font-medium">Drop nodes here to migrate</p>
          <p className="text-xs text-text-muted">Drag a node from source to begin migration</p>
        </div>
      )}
      <ReactFlow
        nodes={syncedNodes}
        edges={syncedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={SIM_NODE_TYPES}
        fitView={!isEmpty}
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="bg-transparent"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e2a3a" />
        <Controls className="!bg-surface-card !border-surface-border" />
        <MiniMap
          className="!bg-surface-raised !border-surface-border"
          nodeColor={(n) => {
            if ((n.data as SimNodeData).success) return '#10b981';
            return '#475569';
          }}
          maskColor="rgba(15,23,42,0.7)"
        />
      </ReactFlow>
    </div>
  );
}

// ── Source Canvas ──────────────────────────────────────────────────────────

interface SourceCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodeDragStart: (event: React.MouseEvent, node: Node) => void;
}

function SourceCanvas({ nodes, edges, onNodeDragStart }: SourceCanvasProps) {
  const [syncedNodes, setSyncedNodes] = useNodesState(nodes);
  const [syncedEdges, setSyncedEdges] = useEdgesState(edges);

  useEffect(() => {
    setSyncedNodes(nodes);
  }, [nodes, setSyncedNodes]);

  useEffect(() => {
    setSyncedEdges(edges);
  }, [edges, setSyncedEdges]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={syncedNodes}
        edges={syncedEdges}
        onNodeDragStart={onNodeDragStart}
        nodeTypes={SIM_NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="bg-transparent"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e2a3a" />
        <Controls className="!bg-surface-card !border-surface-border" />
        <MiniMap
          className="!bg-surface-raised !border-surface-border"
          nodeColor={(n) => {
            const d = n.data as SimNodeData;
            if (d.disabled) return '#334155';
            return '#475569';
          }}
          maskColor="rgba(15,23,42,0.7)"
        />
      </ReactFlow>
    </div>
  );
}

// ── Validation Modal ───────────────────────────────────────────────────────

interface ValidationModalProps {
  nodeId: string | null;
  nodeLabel: string;
  onSuccess: () => void;
  onFailure: () => void;
}

function ValidationModal({ nodeId, nodeLabel, onSuccess, onFailure }: ValidationModalProps) {
  return (
    <AnimatePresence>
      {nodeId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.85, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.85, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="w-full max-w-md mx-4 rounded-2xl overflow-hidden border border-surface-border"
            style={{ background: '#0d1117', boxShadow: '0 24px 60px rgba(0,0,0,0.7)' }}
          >
            <div className="px-6 py-5 border-b border-surface-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-900/30 border border-amber-700/40 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text-primary">Validate Migration</h3>
                  <p className="text-xs text-text-muted mt-0.5">Node: <span className="text-text-secondary font-mono">{nodeLabel}</span></p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-text-secondary leading-relaxed mb-6">
                The migration of <span className="text-text-primary font-semibold">{nodeLabel}</span> and its connected subgraph has been applied to the target topology.
                Validate the migration outcome:
              </p>
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onSuccess}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-sm transition-colors"
                  style={{ boxShadow: '0 4px 16px rgba(16,185,129,0.3)' }}
                >
                  <CheckCircle className="w-4 h-4" />
                  Success
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onFailure}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-700 hover:bg-red-600 text-white font-semibold text-sm transition-colors"
                  style={{ boxShadow: '0 4px 16px rgba(239,68,68,0.3)' }}
                >
                  <XCircle className="w-4 h-4" />
                  Failure
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Rollback Modal ─────────────────────────────────────────────────────────

interface RollbackModalProps {
  show: boolean;
  nodeLabel: string;
  onRollback: () => void;
  onDismiss: () => void;
}

function RollbackModal({ show, nodeLabel, onRollback, onDismiss }: RollbackModalProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.85, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.85, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="w-full max-w-md mx-4 rounded-2xl overflow-hidden border-2 border-red-700/60"
            style={{ background: '#1a0a0a', boxShadow: '0 24px 60px rgba(239,68,68,0.3)' }}
          >
            <div className="px-6 py-5 border-b border-red-800/50 bg-red-900/20">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: [0, -5, 5, -3, 0] }}
                  transition={{ duration: 0.5, repeat: 2 }}
                  className="w-10 h-10 rounded-xl bg-red-900/50 border border-red-600/50 flex items-center justify-center"
                >
                  <XCircle className="w-5 h-5 text-red-400" />
                </motion.div>
                <div>
                  <h3 className="text-base font-bold text-red-300">Migration Failed</h3>
                  <p className="text-xs text-red-400/80 mt-0.5">Rollback available for <span className="font-mono">{nodeLabel}</span></p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-red-200/80 leading-relaxed mb-6">
                The migration of <span className="text-red-200 font-semibold">{nodeLabel}</span> failed validation.
                You can rollback to restore the original state or dismiss to keep the current state.
              </p>
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onRollback}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-700 hover:bg-red-600 text-white font-semibold text-sm transition-colors"
                  style={{ boxShadow: '0 4px 16px rgba(239,68,68,0.4)' }}
                >
                  <RotateCcw className="w-4 h-4" />
                  Rollback
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onDismiss}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-surface-card hover:bg-surface-overlay text-text-secondary font-semibold text-sm transition-colors border border-surface-border"
                >
                  Dismiss
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Success Overlay ────────────────────────────────────────────────────────

function SuccessOverlay({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.2, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="flex flex-col items-center gap-4"
          >
            <motion.div
              animate={{ boxShadow: ['0 0 0px rgba(16,185,129,0)', '0 0 60px rgba(16,185,129,0.6)', '0 0 0px rgba(16,185,129,0)'] }}
              transition={{ duration: 1.5, repeat: 2 }}
              className="w-24 h-24 rounded-full bg-emerald-700/40 border-2 border-emerald-500 flex items-center justify-center"
            >
              <CheckCircle className="w-12 h-12 text-emerald-400" />
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-bold text-emerald-400"
            >
              Migration Successful!
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

interface MigratedNode {
  nodeId: string;
  label: string;
  connectedNodeIds: string[];
}

export default function MigrationSimulationPage() {
  const { sourceTopology, targetTopology } = useAppStore();

  const [disabledSourceNodes, setDisabledSourceNodes] = useState<Set<string>>(new Set());
  const [successSourceNodes, setSuccessSourceNodes] = useState<Set<string>>(new Set());
  const [failedSourceNodes, setFailedSourceNodes] = useState<Set<string>>(new Set());
  const [targetNodes, setTargetNodes] = useState<Node[]>([]);
  const [targetEdges, setTargetEdges] = useState<Edge[]>([]);
  const [successTargetNodes, setSuccessTargetNodes] = useState<Set<string>>(new Set());
  const [pendingValidation, setPendingValidation] = useState<{ nodeId: string; label: string; connectedIds: string[] } | null>(null);
  const [showRollback, setShowRollback] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<{ nodeId: string; label: string; connectedIds: string[] } | null>(null);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [migratedNodes, setMigratedNodes] = useState<MigratedNode[]>([]);

  const dragNodeRef = useRef<Node | null>(null);

  const sourceGraph = sourceTopology;
  const targetGraph = targetTopology;

  const sourceLayout = sourceGraph
    ? buildSimLayout(sourceGraph.nodes, sourceGraph.edges, disabledSourceNodes, successSourceNodes, failedSourceNodes)
    : { nodes: [], edges: [] };

  const targetLayout = { nodes: targetNodes, edges: targetEdges };

  // Find connected subgraph for a given node id from source topology
  const findConnectedSubgraph = useCallback((nodeId: string) => {
    if (!sourceGraph) return { nodeIds: [nodeId], edgeIds: [] };

    const edgeMap = new Map<string, string[]>();
    sourceGraph.edges.forEach((e) => {
      if (!edgeMap.has(e.source)) edgeMap.set(e.source, []);
      if (!edgeMap.has(e.target)) edgeMap.set(e.target, []);
      edgeMap.get(e.source)!.push(e.target);
      edgeMap.get(e.target)!.push(e.source);
    });

    const visited = new Set<string>();
    const queue = [nodeId];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      const neighbors = edgeMap.get(cur) || [];
      neighbors.forEach((n) => { if (!visited.has(n)) queue.push(n); });
    }

    const connectedNodeIds = Array.from(visited);
    const connectedEdgeIds = sourceGraph.edges
      .filter((e) => visited.has(e.source) && visited.has(e.target))
      .map((e) => e.id);

    return { nodeIds: connectedNodeIds, edgeIds: connectedEdgeIds };
  }, [sourceGraph]);

  const handleNodeDragStart = useCallback((_: React.MouseEvent, node: Node) => {
    if ((node.data as SimNodeData).disabled) return;
    dragNodeRef.current = node;
    setDragNodeId(node.id);
  }, []);

  const handleTargetDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const node = dragNodeRef.current;
    if (!node || !sourceGraph || !targetGraph) return;

    const nodeData = node.data as SimNodeData;
    if (nodeData.disabled) return;

    const { nodeIds, edgeIds } = findConnectedSubgraph(node.id);

    // Build target nodes from the connected subgraph using target topology data
    const targetGraphNodes = targetGraph.nodes;
    const targetGraphEdges = targetGraph.edges;

    // Map source node ids to matching target nodes (by label/type)
    const mappedTargetNodes: Node[] = [];
    const mappedTargetEdges: Edge[] = [];

    // Try to find matching nodes in target topology by label
    nodeIds.forEach((srcId, idx) => {
      const srcNode = sourceGraph.nodes.find((n) => n.id === srcId);
      if (!srcNode) return;

      // Find matching node in target by label or id similarity
      const matchingTarget = targetGraphNodes.find(
        (tn) => tn.label === srcNode.label || tn.id === srcId || tn.label.toLowerCase().includes(srcNode.label.toLowerCase())
      );

      const nodeToAdd = matchingTarget || srcNode;
      const existingIds = targetNodes.map((n) => n.id);
      const newId = existingIds.includes(nodeToAdd.id) ? `${nodeToAdd.id}-migrated` : nodeToAdd.id;

      mappedTargetNodes.push({
        id: newId,
        type: nodeToAdd.type || 'qmNode',
        position: {
          x: 100 + (idx % 3) * 200,
          y: 50 + Math.floor(idx / 3) * 160,
        },
        data: {
          ...nodeToAdd,
          id: newId,
          success: false,
          disabled: false,
          migrated: true,
        },
        draggable: false,
      });
    });

    // Add edges between migrated nodes
    edgeIds.forEach((eid) => {
      const srcEdge = sourceGraph.edges.find((e) => e.id === eid);
      if (!srcEdge) return;
      const srcInMapped = mappedTargetNodes.find((n) => n.id === srcEdge.source || n.id === `${srcEdge.source}-migrated`);
      const tgtInMapped = mappedTargetNodes.find((n) => n.id === srcEdge.target || n.id === `${srcEdge.target}-migrated`);
      if (srcInMapped && tgtInMapped) {
        mappedTargetEdges.push({
          id: `migrated-${srcEdge.id}`,
          source: srcInMapped.id,
          target: tgtInMapped.id,
          animated: false,
          markerEnd: { type: MarkerType.ArrowClosed, color: '#475569' },
          style: { stroke: '#334155', strokeWidth: 1.5 },
        });
      }
    });

    const allNewIds = mappedTargetNodes.map((n) => n.id);

    setTargetNodes((prev) => {
      const existingIds = new Set(prev.map((n) => n.id));
      const newOnes = mappedTargetNodes.filter((n) => !existingIds.has(n.id));
      return [...prev, ...newOnes];
    });
    setTargetEdges((prev) => {
      const existingIds = new Set(prev.map((e) => e.id));
      const newOnes = mappedTargetEdges.filter((e) => !existingIds.has(e.id));
      return [...prev, ...newOnes];
    });

    dragNodeRef.current = null;
    setDragNodeId(null);

    // Show validation modal
    setPendingValidation({
      nodeId: node.id,
      label: nodeData.label,
      connectedIds: nodeIds,
    });
  }, [sourceGraph, targetGraph, findConnectedSubgraph, targetNodes]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
  }, []);

  const handleValidationSuccess = useCallback(() => {
    if (!pendingValidation) return;
    const { connectedIds } = pendingValidation;

    // Mark source nodes as disabled
    setDisabledSourceNodes((prev) => {
      const next = new Set(prev);
      connectedIds.forEach((id) => next.add(id));
      return next;
    });
    setSuccessSourceNodes((prev) => {
      const next = new Set(prev);
      connectedIds.forEach((id) => next.add(id));
      return next;
    });

    // Mark target nodes as success (green)
    setTargetNodes((prev) => prev.map((n) => ({
      ...n,
      data: { ...n.data, success: true },
    })));
    setTargetEdges((prev) => prev.map((e) => ({
      ...e,
      animated: true,
      style: { ...e.style, stroke: '#10b981' },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
    })));
    setSuccessTargetNodes((prev) => {
      const next = new Set(prev);
      targetNodes.forEach((n) => next.add(n.id));
      return next;
    });

    setMigratedNodes((prev) => [...prev, {
      nodeId: pendingValidation.nodeId,
      label: pendingValidation.label,
      connectedNodeIds: connectedIds,
    }]);

    setPendingValidation(null);
    setShowSuccessOverlay(true);
    setTimeout(() => setShowSuccessOverlay(false), 3000);
  }, [pendingValidation, targetNodes]);

  const handleValidationFailure = useCallback(() => {
    if (!pendingValidation) return;
    setRollbackTarget(pendingValidation);
    setPendingValidation(null);
    setShowRollback(true);
  }, [pendingValidation]);

  const handleRollback = useCallback(() => {
    if (!rollbackTarget) return;

    // Remove migrated nodes from target
    const migratedIds = new Set(
      targetNodes
        .filter((n) => rollbackTarget.connectedIds.includes(n.id) || rollbackTarget.connectedIds.includes(n.id.replace('-migrated', '')))
        .map((n) => n.id)
    );
    setTargetNodes((prev) => prev.filter((n) => !migratedIds.has(n.id)));
    setTargetEdges((prev) => prev.filter((e) => !migratedIds.has(e.source) && !migratedIds.has(e.target)));

    // Re-enable source nodes
    setDisabledSourceNodes((prev) => {
      const next = new Set(prev);
      rollbackTarget.connectedIds.forEach((id) => next.delete(id));
      return next;
    });
    setFailedSourceNodes((prev) => {
      const next = new Set(prev);
      rollbackTarget.connectedIds.forEach((id) => next.add(id));
      return next;
    });

    setRollbackTarget(null);
    setShowRollback(false);
  }, [rollbackTarget, targetNodes]);

  const handleReset = useCallback(() => {
    setDisabledSourceNodes(new Set());
    setSuccessSourceNodes(new Set());
    setFailedSourceNodes(new Set());
    setTargetNodes([]);
    setTargetEdges([]);
    setSuccessTargetNodes(new Set());
    setPendingValidation(null);
    setShowRollback(false);
    setRollbackTarget(null);
    setMigratedNodes([]);
    dragNodeRef.current = null;
    setDragNodeId(null);
  }, []);

  if (!sourceGraph || !targetGraph) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-7rem)] gap-6">
        <div className="w-20 h-20 rounded-2xl bg-amber-900/20 border border-amber-700/30 flex items-center justify-center">
          <AlertTriangle className="w-10 h-10 text-amber-400" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-text-primary">No Topology Data</h2>
          <p className="text-sm text-text-muted mt-2 max-w-sm">
            Please upload both source and target topologies in the Topology tab before running the migration simulation.
          </p>
        </div>
      </div>
    );
  }

  const migratedCount = migratedNodes.length;
  const totalRootNodes = sourceGraph.nodes.filter((n) => n.type === 'qmNode' || (n.type === 'appNode' && n.role === 'producer')).length;

  return (
    <ReactFlowProvider>
      <div className="flex flex-col gap-4 h-[calc(100vh-7rem)]">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-text-secondary" />
            <h1 className="text-xl font-semibold text-text-primary">Migration Simulation</h1>
            {migratedCount > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-900/30 border border-emerald-700/50 text-xs font-medium text-emerald-300">
                <CheckCircle className="w-3 h-3" />
                {migratedCount} migrated
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-text-muted">
              <span className="text-text-secondary">{disabledSourceNodes.size}</span> / {sourceGraph.nodes.length} nodes migrated
            </div>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-card border border-surface-border text-text-secondary hover:text-text-primary hover:bg-surface-overlay transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-blue-900/20 border border-blue-700/30 text-xs text-blue-300 shrink-0">
          <Play className="w-4 h-4 shrink-0" />
          <span>
            <strong>How to migrate:</strong> Drag a node from the Source canvas (left) and drop it onto the Target canvas (right).
            The entire connected subgraph will migrate. Then validate with Success or Failure.
          </span>
        </div>

        {/* Dual Canvas */}
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Source Canvas */}
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            <div className="flex items-center gap-2 px-1 shrink-0">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Source Topology
              </span>
              <span className="text-xs text-text-muted">
                {sourceGraph.nodes.length - disabledSourceNodes.size} active / {sourceGraph.nodes.length} total
              </span>
            </div>
            <div
              className="flex-1 rounded-xl border border-surface-border overflow-hidden bg-surface-raised"
              onDragStart={(e) => {
                const dragNode = dragNodeRef.current;
                if (dragNode) {
                  e.dataTransfer.setData('nodeId', dragNode.id);
                }
              }}
            >
              <SourceCanvas
                nodes={sourceLayout.nodes}
                edges={sourceLayout.edges}
                onNodeDragStart={handleNodeDragStart}
              />
            </div>
          </div>

          {/* Arrow divider */}
          <div className="flex flex-col items-center justify-center gap-2 shrink-0">
            <motion.div
              animate={{ x: [0, 4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <ArrowRight className="w-6 h-6 text-text-muted" />
            </motion.div>
            <span className="text-[10px] text-text-muted uppercase font-semibold tracking-wider">drag</span>
          </div>

          {/* Target Canvas */}
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            <div className="flex items-center gap-2 px-1 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Target Topology
              </span>
              <span className="text-xs text-text-muted">
                {targetNodes.length} nodes migrated
              </span>
            </div>
            <div className="flex-1 rounded-xl border border-emerald-700/30 overflow-hidden bg-surface-raised">
              <TargetCanvas
                nodes={targetLayout.nodes}
                edges={targetLayout.edges}
                onDrop={handleTargetDrop}
                onDragOver={handleDragOver}
                isEmpty={targetNodes.length === 0}
              />
            </div>
          </div>
        </div>

        {/* Migration log */}
        {migratedNodes.length > 0 && (
          <div className="shrink-0 flex items-center gap-2 flex-wrap px-1">
            <span className="text-xs text-text-muted font-medium">Migrated:</span>
            {migratedNodes.map((m) => (
              <span key={m.nodeId} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/30 border border-emerald-700/40 text-emerald-300">
                {m.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Modals & overlays */}
      <ValidationModal
        nodeId={pendingValidation?.nodeId ?? null}
        nodeLabel={pendingValidation?.label ?? ''}
        onSuccess={handleValidationSuccess}
        onFailure={handleValidationFailure}
      />
      <RollbackModal
        show={showRollback}
        nodeLabel={rollbackTarget?.label ?? ''}
        onRollback={handleRollback}
        onDismiss={() => setShowRollback(false)}
      />
      <SuccessOverlay show={showSuccessOverlay} />
    </ReactFlowProvider>
  );
}
