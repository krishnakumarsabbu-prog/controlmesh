import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { motion } from 'framer-motion';
import { Server, MonitorPlay, GitBranch, Database } from 'lucide-react';
import type { TopologyGraph, TopologyNodeData } from '../../api/topologyUpload';

// ── Custom Node Components ───────────────────────────────────────────────────

function SourceAppNode({ data }: { data: TopologyNodeData & { selected?: boolean } }) {
  const isProducer = data.role === 'producer';
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`relative flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border shadow-lg min-w-[100px] cursor-pointer ${
        isProducer
          ? 'bg-[#0f1e2e] border-blue-700/60 shadow-blue-900/30'
          : 'bg-[#0f2214] border-emerald-700/60 shadow-emerald-900/30'
      } ${data.selected ? 'ring-2 ring-white/30' : ''}`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
        isProducer ? 'bg-blue-900/60' : 'bg-emerald-900/60'
      }`}>
        <MonitorPlay className={`w-4 h-4 ${isProducer ? 'text-blue-400' : 'text-emerald-400'}`} />
      </div>
      <span className="text-[11px] font-semibold text-text-primary leading-tight text-center max-w-[90px] truncate">
        {data.label}
      </span>
      <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
        isProducer ? 'bg-blue-900/50 text-blue-300' : 'bg-emerald-900/50 text-emerald-300'
      }`}>
        {isProducer ? 'Producer App' : 'Consumer App'}
      </span>
      {data.neighborhood && (
        <span className="text-[9px] text-text-muted leading-tight text-center max-w-[90px] truncate">
          {data.neighborhood}
        </span>
      )}
      <Handle type="source" position={Position.Right} className="!bg-blue-500 !w-2 !h-2" />
      <Handle type="target" position={Position.Left} className="!bg-emerald-500 !w-2 !h-2" />
    </motion.div>
  );
}

function SourceQMNode({ data }: { data: TopologyNodeData & { selected?: boolean } }) {
  const isSource = data.role === 'source';
  const queues = data.queues || [];
  const localQ = queues.filter((q) => q.type === 'local').length;
  const remoteQ = queues.filter((q) => q.type === 'remote').length;
  const xmitQ = queues.filter((q) => q.type === 'xmit').length;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35 }}
      className={`relative flex flex-col gap-2 px-3 py-2.5 rounded-xl border shadow-lg min-w-[140px] cursor-pointer ${
        isSource
          ? 'bg-[#1a1228] border-violet-700/60 shadow-violet-900/30'
          : 'bg-[#0e1f1a] border-teal-700/60 shadow-teal-900/30'
      } ${data.selected ? 'ring-2 ring-white/30' : ''}`}
    >
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
          isSource ? 'bg-violet-900/60' : 'bg-teal-900/60'
        }`}>
          <Server className={`w-3.5 h-3.5 ${isSource ? 'text-violet-400' : 'text-teal-400'}`} />
        </div>
        <div>
          <span className="text-[11px] font-semibold text-text-primary block leading-tight max-w-[100px] truncate">
            {data.label}
          </span>
          <span className={`text-[9px] font-medium ${isSource ? 'text-violet-400' : 'text-teal-400'}`}>
            QM {isSource ? '(Source)' : '(Target)'}
          </span>
        </div>
      </div>
      {queues.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {localQ > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300">
              {localQ}L
            </span>
          )}
          {remoteQ > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300">
              {remoteQ}R
            </span>
          )}
          {xmitQ > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-900/60 text-sky-300">
              {xmitQ}X
            </span>
          )}
        </div>
      )}
      <Handle type="source" position={Position.Right} className="!bg-violet-500 !w-2 !h-2" />
      <Handle type="target" position={Position.Left} className="!bg-violet-500 !w-2 !h-2" />
    </motion.div>
  );
}

function SourceChannelNode({ data }: { data: TopologyNodeData & { selected?: boolean } }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl border shadow-lg min-w-[100px] cursor-pointer bg-[#1c1510] border-amber-700/60 shadow-amber-900/20 ${
        data.selected ? 'ring-2 ring-white/30' : ''
      }`}
    >
      <div className="w-7 h-7 rounded-lg bg-amber-900/60 flex items-center justify-center">
        <GitBranch className="w-3.5 h-3.5 text-amber-400" />
      </div>
      <span className="text-[11px] font-semibold text-text-primary max-w-[90px] truncate text-center">
        {data.label}
      </span>
      <span className="text-[9px] text-amber-400 font-medium">Channel</span>
      <Handle type="source" position={Position.Right} className="!bg-amber-500 !w-2 !h-2" />
      <Handle type="target" position={Position.Left} className="!bg-amber-500 !w-2 !h-2" />
    </motion.div>
  );
}

function SourceQueueNode({ data }: { data: TopologyNodeData & { selected?: boolean; queue_type?: string } }) {
  const qtype = data.queue_type || 'local';
  const colors = {
    local: { bg: 'bg-[#141a1f]', border: 'border-slate-600/60', text: 'text-slate-300', badge: 'bg-slate-700/60 text-slate-300' },
    remote: { bg: 'bg-[#1c1510]', border: 'border-amber-700/50', text: 'text-amber-300', badge: 'bg-amber-900/50 text-amber-300' },
    xmit: { bg: 'bg-[#0e1820]', border: 'border-sky-700/50', text: 'text-sky-300', badge: 'bg-sky-900/50 text-sky-300' },
  }[qtype] || { bg: 'bg-[#141a1f]', border: 'border-slate-600/60', text: 'text-slate-300', badge: 'bg-slate-700/60 text-slate-300' };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border cursor-pointer ${colors.bg} ${colors.border} ${data.selected ? 'ring-2 ring-white/20' : ''}`}
    >
      <Database className={`w-3 h-3 ${colors.text} shrink-0`} />
      <span className={`text-[10px] font-medium ${colors.text} max-w-[80px] truncate`}>{data.label}</span>
      <span className={`text-[8px] px-1 py-0.5 rounded font-semibold uppercase ${colors.badge}`}>
        {qtype}
      </span>
      <Handle type="source" position={Position.Right} className="!w-1.5 !h-1.5 !bg-slate-400" />
      <Handle type="target" position={Position.Left} className="!w-1.5 !h-1.5 !bg-slate-400" />
    </motion.div>
  );
}

const SOURCE_NODE_TYPES: NodeTypes = {
  appNode: SourceAppNode,
  qmNode: SourceQMNode,
  channelNode: SourceChannelNode,
  queueNode: SourceQueueNode,
};

// ── Layout Engine ─────────────────────────────────────────────────────────────

function buildLayout(graph: TopologyGraph): { nodes: Node[]; edges: Edge[] } {
  const nodeData = graph.nodes;
  const edgeData = graph.edges;

  const producerApps = nodeData.filter((n) => n.type === 'appNode' && n.role === 'producer');
  const sourceQMs = nodeData.filter((n) => n.type === 'qmNode' && n.role === 'source');
  const channels = nodeData.filter((n) => n.type === 'channelNode');
  const targetQMs = nodeData.filter((n) => n.type === 'qmNode' && n.role === 'target');
  const consumerApps = nodeData.filter((n) => n.type === 'appNode' && n.role === 'consumer');

  const COLS = {
    producerApp: 0,
    sourceQM: 240,
    channel: 500,
    targetQM: 720,
    consumerApp: 960,
  };
  const ROW_GAP = 120;
  const QM_ROW_GAP = 180;
  const QUEUE_GAP = 40;

  const nodes: Node[] = [];

  // Producer apps — deduplicate by id
  const uniqueProducers = Array.from(new Map(producerApps.map((n) => [n.id, n])).values());
  uniqueProducers.forEach((n, i) => {
    nodes.push({
      id: n.id,
      type: 'appNode',
      position: { x: COLS.producerApp, y: i * ROW_GAP + 20 },
      data: { ...n },
    });
  });

  // Source QMs
  const uniqueSourceQMs = Array.from(new Map(sourceQMs.map((n) => [n.id, n])).values());
  let srcQMY = 0;
  uniqueSourceQMs.forEach((n) => {
    nodes.push({
      id: n.id,
      type: 'qmNode',
      position: { x: COLS.sourceQM, y: srcQMY },
      data: { ...n },
    });
    const queueCount = (n.queues || []).length;
    srcQMY += Math.max(QM_ROW_GAP, 80 + queueCount * QUEUE_GAP);
  });

  // Channels
  const uniqueChannels = Array.from(new Map(channels.map((n) => [n.id, n])).values());
  uniqueChannels.forEach((n, i) => {
    nodes.push({
      id: n.id,
      type: 'channelNode',
      position: { x: COLS.channel, y: i * 100 + 30 },
      data: { ...n },
    });
  });

  // Target QMs
  const uniqueTargetQMs = Array.from(new Map(targetQMs.map((n) => [n.id, n])).values());
  let tgtQMY = 0;
  uniqueTargetQMs.forEach((n) => {
    nodes.push({
      id: n.id,
      type: 'qmNode',
      position: { x: COLS.targetQM, y: tgtQMY },
      data: { ...n },
    });
    const queueCount = (n.queues || []).length;
    tgtQMY += Math.max(QM_ROW_GAP, 80 + queueCount * QUEUE_GAP);
  });

  // Consumer apps
  const uniqueConsumers = Array.from(new Map(consumerApps.map((n) => [n.id, n])).values());
  uniqueConsumers.forEach((n, i) => {
    nodes.push({
      id: n.id,
      type: 'appNode',
      position: { x: COLS.consumerApp, y: i * ROW_GAP + 20 },
      data: { ...n },
    });
  });

  // Build edges from graph edges
  const edges: Edge[] = edgeData.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label || undefined,
    labelStyle: { fontSize: 9, fill: '#94a3b8' },
    labelBgStyle: { fill: '#1e293b', fillOpacity: 0.8 },
    animated: e.type === 'channel',
    markerEnd: { type: MarkerType.ArrowClosed, color: e.type === 'channel' ? '#f59e0b' : '#475569' },
    style: {
      stroke: e.type === 'channel' ? '#b45309' : '#334155',
      strokeWidth: e.type === 'channel' ? 2 : 1.5,
      strokeDasharray: e.flow_type === 'Remote' ? '6 3' : undefined,
    },
  }));

  return { nodes, edges };
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  graph: TopologyGraph;
  onNodeClick?: (node: TopologyNodeData) => void;
}

export default function SourceTopologyGraph({ graph, onNodeClick }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const layout = useMemo(() => buildLayout(graph), [graph]);

  const nodesWithSelection = useMemo(() =>
    layout.nodes.map((n) => ({
      ...n,
      data: { ...n.data, selected: n.id === selectedId },
    })),
    [layout.nodes, selectedId]
  );

  const [nodes, , onNodesChange] = useNodesState(nodesWithSelection);
  const [edges, , onEdgesChange] = useEdgesState(layout.edges);

  // Update nodes when graph changes
  const prevGraphRef = useRef<string>('');
  const [rfNodes, setRfNodes] = useNodesState<TopologyNodeData>(nodesWithSelection);
  const [rfEdges, setRfEdges] = useEdgesState(layout.edges);

  useEffect(() => {
    const key = JSON.stringify(graph.nodes.map((n) => n.id));
    if (key !== prevGraphRef.current) {
      prevGraphRef.current = key;
      setRfNodes(nodesWithSelection);
      setRfEdges(layout.edges);
    }
  }, [graph, nodesWithSelection, layout.edges, setRfNodes, setRfEdges]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedId(node.id);
    onNodeClick?.(node.data as TopologyNodeData);
  }, [onNodeClick]);

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange as ReturnType<typeof useNodesState>[2]}
        onEdgesChange={onEdgesChange as ReturnType<typeof useEdgesState>[2]}
        nodeTypes={SOURCE_NODE_TYPES}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="bg-transparent"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e293b" />
        <Controls className="!bg-surface-card !border-surface-border" />
        <MiniMap
          className="!bg-surface-raised !border-surface-border"
          nodeColor={(n) => {
            const t = (n.data as TopologyNodeData).type;
            if (t === 'appNode') return '#3b82f6';
            if (t === 'qmNode') return '#8b5cf6';
            if (t === 'channelNode') return '#f59e0b';
            return '#475569';
          }}
          maskColor="rgba(15,23,42,0.7)"
        />
      </ReactFlow>

      {/* Legend */}
      <div className="absolute bottom-10 left-3 flex items-center gap-2 flex-wrap pointer-events-none">
        {[
          { color: 'bg-blue-500', label: 'Producer App' },
          { color: 'bg-violet-500', label: 'Queue Manager' },
          { color: 'bg-amber-500', label: 'Channel' },
          { color: 'bg-emerald-500', label: 'Consumer App' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-surface-card/80 border border-surface-border text-[10px] text-text-muted">
            <span className={`w-2 h-2 rounded-full ${color}`} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
