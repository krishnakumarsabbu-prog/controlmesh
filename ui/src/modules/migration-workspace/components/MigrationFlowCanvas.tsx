import { useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  type Node,
  type Edge,
  BackgroundVariant,
  Handle,
  Position,
  EdgeProps,
  getBezierPath,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import { MOCK_APPLICATIONS, MOCK_FLOWS } from '../mock/data';
import { useWorkspaceStore } from '../store/workspaceStore';

// ── Glow edge custom CSS injected once ────────────────────────────────────────
const GLOW_STYLE = `
  @keyframes msg-dot-move {
    0%   { offset-distance: 0%;   opacity: 1; }
    80%  { opacity: 1; }
    100% { offset-distance: 100%; opacity: 0; }
  }
  .msg-dot {
    position: absolute;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    pointer-events: none;
    animation: msg-dot-move 2s linear infinite;
  }
`;

// ── ProducerAppNode ────────────────────────────────────────────────────────────
function ProducerAppNode({ data }: { data: { label: string; queue: string; tps: number; status: string } }) {
  const color = data.status === 'healthy' ? '#22c55e' : data.status === 'degraded' ? '#f59e0b' : '#ef4444';
  const glowColor = data.status === 'healthy' ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)';
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.03 }}
      className="relative rounded-xl border text-xs font-medium overflow-hidden cursor-pointer"
      style={{
        background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(6,182,212,0.06) 100%)',
        borderColor: 'rgba(16,185,129,0.35)',
        minWidth: 148,
        boxShadow: `0 0 18px rgba(16,185,129,0.12), inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}
    >
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#22d3ee', border: '2px solid rgba(34,211,238,0.4)', width: 10, height: 10 }}
      />
      {/* Top accent bar */}
      <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
      <div className="px-3 pt-2.5 pb-2.5">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: color, boxShadow: `0 0 6px ${glowColor}` }} />
          <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#10b981' }}>Producer</span>
        </div>
        <div className="font-bold text-[13px] mb-1" style={{ color: 'var(--text-primary)' }}>{data.label}</div>
        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{data.queue}</div>
        <div className="flex items-center gap-1 mt-2">
          <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-1 rounded-sm" style={{
                height: 8 + Math.sin(i * 1.2) * 4,
                background: i < 4 ? '#22d3ee' : 'rgba(34,211,238,0.25)',
              }} />
            ))}
          </div>
          <span className="text-[10px] font-semibold ml-1" style={{ color: '#22d3ee' }}>{data.tps.toLocaleString()} TPS</span>
        </div>
      </div>
    </motion.div>
  );
}

// ── ConsumerAppNode ────────────────────────────────────────────────────────────
function ConsumerAppNode({ data }: { data: { label: string; queue: string; tps: number; status: string } }) {
  const color = data.status === 'healthy' ? '#22c55e' : data.status === 'degraded' ? '#f59e0b' : '#ef4444';
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.03 }}
      className="relative rounded-xl border text-xs font-medium overflow-hidden cursor-pointer"
      style={{
        background: 'linear-gradient(135deg, rgba(6,182,212,0.08) 0%, rgba(99,102,241,0.06) 100%)',
        borderColor: 'rgba(6,182,212,0.35)',
        minWidth: 148,
        boxShadow: `0 0 18px rgba(6,182,212,0.1), inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#22d3ee', border: '2px solid rgba(34,211,238,0.4)', width: 10, height: 10 }}
      />
      <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #22d3ee, transparent)' }} />
      <div className="px-3 pt-2.5 pb-2.5">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: color, boxShadow: `0 0 6px rgba(34,197,94,0.4)` }} />
          <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#22d3ee' }}>Consumer</span>
        </div>
        <div className="font-bold text-[13px] mb-1" style={{ color: 'var(--text-primary)' }}>{data.label}</div>
        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{data.queue}</div>
        <div className="flex items-center gap-1 mt-2">
          <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-1 rounded-sm" style={{
                height: 6 + Math.cos(i * 0.9) * 4,
                background: i < 4 ? '#6366f1' : 'rgba(99,102,241,0.25)',
              }} />
            ))}
          </div>
          <span className="text-[10px] font-semibold ml-1" style={{ color: '#818cf8' }}>{data.tps.toLocaleString()} TPS</span>
        </div>
      </div>
    </motion.div>
  );
}

// ── QueueManagerNode ───────────────────────────────────────────────────────────
function QueueManagerNode({ data }: { data: { label: string; role: 'source' | 'target'; queueCount?: number; channelCount?: number } }) {
  const isSrc = data.role === 'source';
  const accent = isSrc ? '#22d3ee' : '#a78bfa';
  const bg = isSrc ? 'rgba(6,182,212,0.08)' : 'rgba(139,92,246,0.08)';
  const border = isSrc ? 'rgba(6,182,212,0.4)' : 'rgba(139,92,246,0.4)';
  const glow = isSrc ? 'rgba(6,182,212,0.2)' : 'rgba(139,92,246,0.2)';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      className="rounded-2xl border-2 text-center overflow-hidden relative"
      style={{
        background: bg,
        borderColor: border,
        minWidth: 150,
        boxShadow: `0 0 30px ${glow}, 0 0 60px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)`,
      }}
    >
      <Handle type="source" position={Position.Right} style={{ background: accent, border: `2px solid ${border}`, width: 10, height: 10 }} />
      <Handle type="target" position={Position.Left}  style={{ background: accent, border: `2px solid ${border}`, width: 10, height: 10 }} />
      {/* Animated top glow */}
      <motion.div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="px-4 pt-3.5 pb-3">
        <div className="text-[9px] uppercase tracking-widest mb-1.5 font-semibold" style={{ color: accent, opacity: 0.8 }}>
          {isSrc ? 'Source QM' : 'Target QM'}
        </div>
        <div className="font-bold text-sm mb-2" style={{ color: accent }}>{data.label}</div>
        <div className="flex justify-center gap-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
          <span><span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>{data.queueCount ?? 14}</span> Q</span>
          <span><span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>{data.channelCount ?? 3}</span> CH</span>
        </div>
        {/* Live badge */}
        <motion.div
          className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]"
          style={{ background: `rgba(${isSrc ? '6,182,212' : '139,92,246'},0.15)`, color: accent }}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
          Active
        </motion.div>
      </div>
    </motion.div>
  );
}

// ── QueueNode ──────────────────────────────────────────────────────────────────
function QueueNode({ data }: { data: { label: string; depth?: number; maxDepth?: number } }) {
  const depth = data.depth ?? 0;
  const max = data.maxDepth ?? 1000;
  const pct = Math.min((depth / max) * 100, 100);
  const fillColor = pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#22c55e';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.04 }}
      className="rounded-lg border overflow-hidden"
      style={{
        background: 'rgba(20,27,45,0.9)',
        borderColor: 'rgba(34,211,238,0.2)',
        minWidth: 110,
        boxShadow: '0 0 12px rgba(34,211,238,0.06)',
      }}
    >
      <Handle type="target" position={Position.Left}  style={{ background: '#22d3ee', border: 'none', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ background: '#22d3ee', border: 'none', width: 8, height: 8 }} />
      <div className="px-2.5 py-2">
        <div className="text-[9px] uppercase tracking-widest mb-1 font-semibold" style={{ color: 'rgba(34,211,238,0.6)' }}>Queue</div>
        <div className="text-[11px] font-bold mb-1.5 truncate" style={{ color: 'var(--text-primary)', maxWidth: 90 }}>{data.label}</div>
        {/* Depth bar */}
        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: fillColor }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        <div className="text-[9px] mt-1" style={{ color: 'var(--text-muted)' }}>{depth.toLocaleString()} / {max.toLocaleString()}</div>
      </div>
    </motion.div>
  );
}

// ── ChannelNode ────────────────────────────────────────────────────────────────
function ChannelNode({ data }: { data: { label: string; state: 'running' | 'stopped' | 'retrying' } }) {
  const colors: Record<string, string> = { running: '#22c55e', stopped: '#6b7280', retrying: '#f59e0b' };
  const c = colors[data.state] ?? '#22c55e';
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      whileHover={{ scale: 1.05 }}
      className="rounded-lg border px-2.5 py-1.5"
      style={{
        background: 'rgba(14,20,36,0.95)',
        borderColor: `rgba(${data.state === 'running' ? '34,197,94' : '107,114,128'},0.3)`,
        minWidth: 90,
        boxShadow: data.state === 'running' ? '0 0 10px rgba(34,197,94,0.1)' : 'none',
      }}
    >
      <Handle type="target" position={Position.Left}  style={{ background: c, border: 'none', width: 6, height: 6 }} />
      <Handle type="source" position={Position.Right} style={{ background: c, border: 'none', width: 6, height: 6 }} />
      <div className="text-[9px] uppercase tracking-widest mb-0.5 font-semibold" style={{ color: 'rgba(34,197,94,0.5)' }}>Channel</div>
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: c, boxShadow: `0 0 4px ${c}` }} />
        <span className="text-[10px] font-bold" style={{ color: 'var(--text-primary)' }}>{data.label}</span>
      </div>
    </motion.div>
  );
}

// ── Animated Glow Edge ─────────────────────────────────────────────────────────
function GlowEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  data, style = {},
}: EdgeProps & { data?: { color?: string; animated?: boolean } }) {
  const color = data?.color ?? '#22d3ee';
  const [edgePath] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  return (
    <g>
      {/* Outer glow */}
      <path
        id={`${id}-glow`}
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeOpacity={0.12}
        strokeLinecap="round"
      />
      {/* Main path */}
      <path
        id={`${id}-path`}
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeOpacity={0.75}
        strokeLinecap="round"
        style={style as React.CSSProperties}
      />
      {/* Animated message dot */}
      {data?.animated !== false && (
        <>
          <circle r={4} fill={color} opacity={0.9}>
            <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} />
          </circle>
          <circle r={3} fill="white" opacity={0.6}>
            <animateMotion dur="2s" repeatCount="indefinite" begin="0.7s" path={edgePath} />
          </circle>
        </>
      )}
    </g>
  );
}

function DashGlowEdge(props: EdgeProps & { data?: { color?: string } }) {
  const color = props.data?.color ?? '#a78bfa';
  const [edgePath] = getBezierPath({
    sourceX: props.sourceX, sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX, targetY: props.targetY,
    targetPosition: props.targetPosition,
  });
  return (
    <g>
      <path d={edgePath} fill="none" stroke={color} strokeWidth={5} strokeOpacity={0.08} strokeLinecap="round" />
      <path
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeOpacity={0.5}
        strokeLinecap="round"
        strokeDasharray="6 5"
      />
      {/* Slow migrating dot */}
      <circle r={3.5} fill={color} opacity={0.7}>
        <animateMotion dur="3.5s" repeatCount="indefinite" path={edgePath} />
      </circle>
    </g>
  );
}

const nodeTypes = {
  producerApp:    ProducerAppNode,
  consumerApp:    ConsumerAppNode,
  queueManager:   QueueManagerNode,
  queue:          QueueNode,
  channel:        ChannelNode,
};

const edgeTypes = {
  glowEdge:     GlowEdge,
  dashGlowEdge: DashGlowEdge,
};

// ── Build rich graph ───────────────────────────────────────────────────────────
function buildRichGraph(appId: string | null): { nodes: Node[]; edges: Edge[] } {
  const app = MOCK_APPLICATIONS.find(a => a.id === appId) ?? MOCK_APPLICATIONS[0];
  const flow = MOCK_FLOWS.find(f => f.appId === app.id) ?? MOCK_FLOWS[0];

  const prodCount = app.producers.length;
  const consCount = app.consumers.length;

  // Vertical spacing
  const vSpacing = 120;
  const prodHeight = prodCount * vSpacing;
  const consHeight = consCount * vSpacing;
  const centerY = Math.max(prodHeight, consHeight) / 2;

  const nodes: Node[] = [
    // Producers (leftmost column)
    ...app.producers.map((svc, i) => ({
      id: svc.id,
      type: 'producerApp',
      position: { x: 20, y: i * vSpacing + (centerY - prodHeight / 2) + 20 },
      data: { label: svc.name, queue: svc.queue, tps: svc.tps, status: svc.status },
      draggable: false,
    })),
    // Source queue (between producer and source QM)
    {
      id: 'q-out',
      type: 'queue',
      position: { x: 220, y: centerY - 30 },
      data: { label: app.producers[0]?.queue ?? 'OUT.Q', depth: 47, maxDepth: 500 },
      draggable: false,
    },
    // Channel from source Q to source QM
    {
      id: 'ch-src',
      type: 'channel',
      position: { x: 370, y: centerY - 20 },
      data: { label: 'CHAN.SRC', state: 'running' },
      draggable: false,
    },
    // Source QM (center-left)
    {
      id: 'qm-source',
      type: 'queueManager',
      position: { x: 500, y: centerY - 55 },
      data: { label: flow.sourceQM, role: 'source', queueCount: 14, channelCount: 3 },
      draggable: false,
    },
    // Channel between QMs
    {
      id: 'ch-bridge',
      type: 'channel',
      position: { x: 700, y: centerY - 20 },
      data: { label: 'CHAN.BRIDGE', state: 'running' },
      draggable: false,
    },
    // Target QM (center-right)
    {
      id: 'qm-target',
      type: 'queueManager',
      position: { x: 830, y: centerY - 55 },
      data: { label: flow.targetQM, role: 'target', queueCount: 14, channelCount: 3 },
      draggable: false,
    },
    // Channel from target QM to target queue
    {
      id: 'ch-tgt',
      type: 'channel',
      position: { x: 1030, y: centerY - 20 },
      data: { label: 'CHAN.TGT', state: 'stopped' },
      draggable: false,
    },
    // Target queue (between target QM and consumers)
    {
      id: 'q-in',
      type: 'queue',
      position: { x: 1160, y: centerY - 30 },
      data: { label: app.consumers[0]?.queue ?? 'IN.Q', depth: 0, maxDepth: 500 },
      draggable: false,
    },
    // Consumers (rightmost column)
    ...app.consumers.map((svc, i) => ({
      id: svc.id,
      type: 'consumerApp',
      position: { x: 1340, y: i * vSpacing + (centerY - consHeight / 2) + 20 },
      data: { label: svc.name, queue: svc.queue, tps: svc.tps, status: svc.status },
      draggable: false,
    })),
  ];

  const edges: Edge[] = [
    // Producers → outbound queue
    ...app.producers.map(svc => ({
      id: `e-${svc.id}-qout`,
      source: svc.id,
      target: 'q-out',
      type: 'glowEdge',
      data: { color: '#10b981', animated: true },
    })),
    // Queue → Channel
    { id: 'e-qout-ch', source: 'q-out', target: 'ch-src', type: 'glowEdge', data: { color: '#22d3ee', animated: true } },
    // Channel → Source QM
    { id: 'e-ch-srcqm', source: 'ch-src', target: 'qm-source', type: 'glowEdge', data: { color: '#22d3ee', animated: true } },
    // Source QM → Bridge channel
    { id: 'e-srcqm-bridge', source: 'qm-source', target: 'ch-bridge', type: 'dashGlowEdge', data: { color: flow.activePath !== 'source' ? '#a78bfa' : '#22d3ee' } },
    // Bridge channel → Target QM
    { id: 'e-bridge-tgtqm', source: 'ch-bridge', target: 'qm-target', type: 'dashGlowEdge', data: { color: '#a78bfa' } },
    // Target QM → target channel
    { id: 'e-tgtqm-chtgt', source: 'qm-target', target: 'ch-tgt', type: 'glowEdge', data: { color: '#a78bfa', animated: false } },
    // Target channel → inbound queue
    { id: 'e-chtgt-qin', source: 'ch-tgt', target: 'q-in', type: 'glowEdge', data: { color: '#818cf8', animated: false } },
    // Inbound queue → Consumers
    ...app.consumers.map(svc => ({
      id: `e-qin-${svc.id}`,
      source: 'q-in',
      target: svc.id,
      type: 'glowEdge',
      data: { color: '#818cf8', animated: false },
    })),
  ];

  return { nodes, edges };
}

// ── Canvas ─────────────────────────────────────────────────────────────────────
export default function MigrationFlowCanvas() {
  const { selectedAppId } = useWorkspaceStore();
  const { nodes: initialNodes, edges: initialEdges } = buildRichGraph(selectedAppId);
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="w-full h-full overflow-hidden" style={{ background: 'var(--surface-base)' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll
        zoomOnScroll
        minZoom={0.4}
        maxZoom={1.8}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="rgba(255,255,255,0.035)"
        />
        <Controls
          showInteractive={false}
          style={{
            background: 'var(--surface-raised)',
            border: '1px solid var(--surface-border)',
            borderRadius: 8,
          }}
        />
      </ReactFlow>
    </div>
  );
}
