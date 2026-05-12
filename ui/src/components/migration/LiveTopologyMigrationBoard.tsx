import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  MarkerType,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Server,
  MonitorPlay,
  GitBranch,
  Database,
  CircleCheck as CheckCircle2,
  Loader as Loader2,
  Circle as XCircle,
  Zap,
  ArrowRight,
  PackageOpen,
  MousePointerClick,
  ChevronsRight,
} from 'lucide-react';
import { startProvisioning, openProvisionEventStream } from '../../api/topologyUpload';
import type { ProvisionEvent } from '../../api/topologyUpload';

// ── Types ────────────────────────────────────────────────────────────────────

interface QueueDef { name: string; type: 'local' | 'remote' | 'xmit'; }

interface SourceNodeDef {
  id: string;
  nodeType: 'qm' | 'app' | 'channel';
  label: string;
  role?: 'producer' | 'consumer' | 'source' | 'target';
  parentQm?: string;
  neighborhood?: string;
  queues?: QueueDef[];
}

type ProvisionStatus = 'pending' | 'provisioning' | 'success' | 'failed';

interface TargetNodeState {
  id: string;
  status: ProvisionStatus;
  log: string[];
}

// ── Static topology data ─────────────────────────────────────────────────────

const SOURCE_NODES: SourceNodeDef[] = [
  { id: 'app_order_svc',   nodeType: 'app',     label: 'APP.ORDER.SVC',   role: 'producer',  neighborhood: 'orders' },
  { id: 'app_notify_svc',  nodeType: 'app',     label: 'APP.NOTIFY.SVC',  role: 'producer',  neighborhood: 'notify' },
  {
    id: 'qm_src_a', nodeType: 'qm', label: 'QM.SRC.A', role: 'source',
    queues: [
      { name: 'ORDERS.LOCAL', type: 'local' }, { name: 'ORDERS.REPLY', type: 'local' },
      { name: 'ORDERS.DLQ',   type: 'local' }, { name: 'NOTIFY.LOCAL', type: 'local' },
      { name: 'XMIT.APP.A',   type: 'xmit'  },
    ],
  },
  {
    id: 'qm_src_b', nodeType: 'qm', label: 'QM.SRC.B', role: 'source',
    queues: [
      { name: 'PAYMENT.LOCAL', type: 'local' },
      { name: 'PAYMENT.DLQ',  type: 'local' },
      { name: 'XMIT.APP.B',   type: 'xmit'  },
    ],
  },
  { id: 'ch_chnl_src_app', nodeType: 'channel', label: 'CHNL.SRC.APP', parentQm: 'QM.SRC.A' },
  { id: 'ch_chnl_src_pay', nodeType: 'channel', label: 'CHNL.SRC.PAY', parentQm: 'QM.SRC.B' },
  { id: 'app_fulfillment', nodeType: 'app',     label: 'APP.FULFILLMENT', role: 'consumer', neighborhood: 'fulfillment' },
  { id: 'app_payment_svc', nodeType: 'app',     label: 'APP.PAYMENT.SVC', role: 'consumer', neighborhood: 'payment' },
];

const SOURCE_EDGES = [
  { id: 'e1', source: 'app_order_svc',  target: 'qm_src_a',        kind: 'app' },
  { id: 'e2', source: 'app_notify_svc', target: 'qm_src_a',        kind: 'app' },
  { id: 'e3', source: 'qm_src_a',       target: 'ch_chnl_src_app', kind: 'channel' },
  { id: 'e4', source: 'ch_chnl_src_app',target: 'app_fulfillment', kind: 'channel' },
  { id: 'e5', source: 'app_payment_svc',target: 'qm_src_b',        kind: 'app' },
  { id: 'e6', source: 'qm_src_b',       target: 'ch_chnl_src_pay', kind: 'channel' },
  { id: 'e7', source: 'ch_chnl_src_pay',target: 'app_fulfillment', kind: 'channel' },
];

// Clicking one node also migrates these related nodes
const RELATED_MAP: Record<string, string[]> = {
  qm_src_a:         ['ch_chnl_src_app', 'app_order_svc', 'app_notify_svc', 'app_fulfillment'],
  qm_src_b:         ['ch_chnl_src_pay', 'app_payment_svc'],
  app_order_svc:    ['qm_src_a'],
  app_notify_svc:   ['qm_src_a'],
  app_fulfillment:  ['qm_src_a'],
  app_payment_svc:  ['qm_src_b'],
  ch_chnl_src_app:  ['qm_src_a'],
  ch_chnl_src_pay:  ['qm_src_b'],
};

const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  app_order_svc:   { x: 0,   y: 40  },
  app_notify_svc:  { x: 0,   y: 195 },
  app_payment_svc: { x: 0,   y: 380 },
  qm_src_a:        { x: 215, y: 0   },
  qm_src_b:        { x: 215, y: 310 },
  ch_chnl_src_app: { x: 455, y: 80  },
  ch_chnl_src_pay: { x: 455, y: 330 },
  app_fulfillment: { x: 645, y: 175 },
};

const RF_TYPE: Record<string, string> = {
  app_order_svc: 'appNode', app_notify_svc: 'appNode',
  app_fulfillment: 'appNode', app_payment_svc: 'appNode',
  qm_src_a: 'qmNode', qm_src_b: 'qmNode',
  ch_chnl_src_app: 'channelNode', ch_chnl_src_pay: 'channelNode',
};

// ── Source node React-Flow components ────────────────────────────────────────

interface SrcData extends SourceNodeDef {
  migrated: boolean;
  hovered: boolean;
  onMigrate: () => void;
}

function SrcAppNode({ data }: { data: SrcData }) {
  const isProd = data.role === 'producer';
  return (
    <div
      onClick={data.migrated ? undefined : data.onMigrate}
      className={`relative rounded-xl border-2 shadow-lg min-w-[130px] transition-all duration-200 ${
        data.migrated
          ? 'opacity-30 grayscale cursor-default'
          : 'cursor-pointer'
      } ${isProd ? 'bg-[#0f1e2e] border-blue-600/70' : 'bg-[#0f2214] border-emerald-600/70'}`}
      style={{
        boxShadow: !data.migrated && data.hovered
          ? `0 0 0 2px rgba(255,255,255,0.2), 0 0 22px ${isProd ? 'rgba(59,130,246,0.55)' : 'rgba(16,185,129,0.55)'}`
          : undefined,
      }}
    >
      {!data.migrated && data.hovered && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold text-sky-300 px-2 py-0.5 rounded-full z-10"
          style={{ background: 'rgba(14,165,233,0.18)', border: '1px solid rgba(14,165,233,0.35)' }}>
          click to migrate
        </div>
      )}
      <div className={`flex items-center gap-2 px-2.5 py-2 rounded-t-xl ${isProd ? 'bg-blue-900/40' : 'bg-emerald-900/40'}`}>
        <MonitorPlay className={`w-3.5 h-3.5 shrink-0 ${isProd ? 'text-blue-400' : 'text-emerald-400'}`} />
        <span className={`text-[11px] font-bold truncate tracking-wide flex-1 ${isProd ? 'text-blue-100' : 'text-emerald-100'}`}>{data.label}</span>
        {data.migrated
          ? <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
          : <MousePointerClick className="w-3 h-3 text-slate-500 shrink-0 opacity-60" />
        }
      </div>
      <div className="px-2.5 py-1.5">
        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${isProd ? 'bg-blue-900/50 text-blue-300' : 'bg-emerald-900/50 text-emerald-300'}`}>
          {isProd ? 'Producer' : 'Consumer'}
        </span>
        {data.neighborhood && <div className="text-[9px] text-slate-500 mt-1 font-mono">{data.neighborhood}</div>}
      </div>
      <Handle type="source" position={Position.Right} className={`!w-2.5 !h-2.5 !border-2 ${isProd ? '!bg-blue-500 !border-blue-300' : '!bg-emerald-500 !border-emerald-300'}`} />
      <Handle type="target" position={Position.Left}  className={`!w-2.5 !h-2.5 !border-2 ${isProd ? '!bg-blue-500 !border-blue-300' : '!bg-emerald-500 !border-emerald-300'}`} />
    </div>
  );
}

function SrcQMNode({ data }: { data: SrcData }) {
  const isSource = data.role === 'source';
  return (
    <div
      onClick={data.migrated ? undefined : data.onMigrate}
      className={`relative rounded-xl border-2 shadow-xl min-w-[162px] transition-all duration-200 ${
        data.migrated ? 'opacity-30 grayscale cursor-default' : 'cursor-pointer'
      } ${isSource ? 'bg-[#13102a] border-violet-600/70' : 'bg-[#0e1a28] border-teal-600/70'}`}
      style={{
        boxShadow: !data.migrated && data.hovered
          ? 'rgba(167,139,250,0.55) 0 0 0 2px, rgba(167,139,250,0.4) 0 0 22px'
          : '0 4px 16px rgba(0,0,0,0.5)',
      }}
    >
      {!data.migrated && data.hovered && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold text-sky-300 px-2 py-0.5 rounded-full z-10"
          style={{ background: 'rgba(14,165,233,0.18)', border: '1px solid rgba(14,165,233,0.35)' }}>
          click to migrate group
        </div>
      )}
      <div className={`flex items-center gap-2 px-2.5 py-2 rounded-t-xl ${isSource ? 'bg-violet-900/50' : 'bg-teal-900/50'}`}>
        <Server className={`w-3.5 h-3.5 shrink-0 ${isSource ? 'text-violet-400' : 'text-teal-400'}`} />
        <span className={`text-[11px] font-bold truncate tracking-wide flex-1 ${isSource ? 'text-violet-100' : 'text-teal-100'}`}>{data.label}</span>
        {data.migrated
          ? <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
          : <MousePointerClick className="w-3 h-3 text-slate-500 shrink-0 opacity-60" />
        }
      </div>
      <div className="px-2.5 py-2 space-y-1.5">
        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${isSource ? 'bg-violet-900/50 text-violet-300' : 'bg-teal-900/50 text-teal-300'}`}>
          QM {isSource ? '(Source)' : '(Target)'}
        </span>
        {(data.queues || []).length > 0 && (
          <div className="space-y-0.5 mt-1">
            {(data.queues || []).map(q => (
              <div key={q.name} className="flex items-center gap-1.5 text-[10px]">
                <span className={`w-1 h-1 rounded-full shrink-0 ${q.type === 'xmit' ? 'bg-sky-400' : q.type === 'remote' ? 'bg-amber-400' : 'bg-slate-500'}`} />
                <span className={`font-mono truncate ${q.type === 'xmit' ? 'text-sky-300/80' : q.type === 'remote' ? 'text-amber-300/80' : 'text-slate-400'}`}>{q.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} className={`!w-2.5 !h-2.5 !border-2 ${isSource ? '!bg-violet-500 !border-violet-300' : '!bg-teal-500 !border-teal-300'}`} />
      <Handle type="target" position={Position.Left}  className={`!w-2.5 !h-2.5 !border-2 ${isSource ? '!bg-violet-500 !border-violet-300' : '!bg-teal-500 !border-teal-300'}`} />
    </div>
  );
}

function SrcChannelNode({ data }: { data: SrcData }) {
  return (
    <div
      onClick={data.migrated ? undefined : data.onMigrate}
      className={`relative flex flex-col items-center gap-1 px-2.5 py-2 rounded-xl border-2 shadow-lg min-w-[115px] bg-[#1c1510] border-amber-600/60 transition-all duration-200 ${
        data.migrated ? 'opacity-30 grayscale cursor-default' : 'cursor-pointer'
      }`}
      style={{
        boxShadow: !data.migrated && data.hovered
          ? '0 0 0 2px rgba(245,158,11,0.4), 0 0 20px rgba(245,158,11,0.4)'
          : undefined,
      }}
    >
      {!data.migrated && data.hovered && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold text-sky-300 px-2 py-0.5 rounded-full z-10"
          style={{ background: 'rgba(14,165,233,0.18)', border: '1px solid rgba(14,165,233,0.35)' }}>
          click to migrate
        </div>
      )}
      <div className="flex items-center gap-1.5 w-full">
        <div className="w-6 h-6 rounded-lg bg-amber-900/60 flex items-center justify-center shrink-0">
          <GitBranch className="w-3 h-3 text-amber-400" />
        </div>
        <span className="text-[10px] font-bold text-amber-100 truncate flex-1">{data.label}</span>
        {data.migrated
          ? <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
          : <MousePointerClick className="w-3 h-3 text-slate-500 shrink-0 opacity-60" />
        }
      </div>
      <span className="text-[8px] text-amber-400 font-medium">Channel</span>
      {data.parentQm && <span className="text-[8px] text-amber-500/60 font-mono truncate w-full text-center">via {data.parentQm}</span>}
      <Handle type="source" position={Position.Right} className="!bg-amber-500 !w-2.5 !h-2.5 !border-2 !border-amber-300" />
      <Handle type="target" position={Position.Left}  className="!bg-amber-500 !w-2.5 !h-2.5 !border-2 !border-amber-300" />
    </div>
  );
}

// ── Target node React-Flow components ─────────────────────────────────────────

interface TgtData extends SourceNodeDef {
  status: ProvisionStatus;
}

function StatusIcon({ status }: { status: ProvisionStatus }) {
  if (status === 'provisioning') return (
    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
      <Loader2 className="w-3 h-3 text-sky-400 shrink-0" />
    </motion.div>
  );
  if (status === 'success') return (
    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400 }}>
      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
    </motion.div>
  );
  if (status === 'failed') return <XCircle className="w-3 h-3 text-red-400 shrink-0" />;
  return <span className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0 mt-0.5" />;
}

function ProvisionRing({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <motion.div
      className="absolute inset-0 rounded-xl border-2 border-sky-400/40 pointer-events-none"
      animate={{ opacity: [0.7, 0, 0.7] }}
      transition={{ duration: 1.2, repeat: Infinity }}
    />
  );
}

function TgtAppNode({ data }: { data: TgtData }) {
  const isProd = data.role === 'producer';
  const ip = data.status === 'provisioning';
  const ok = data.status === 'success';
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.75, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      className={`relative rounded-xl border-2 shadow-lg min-w-[130px] ${
        ip ? 'bg-sky-950/80 border-sky-500/70' :
        ok ? (isProd ? 'bg-blue-950/90 border-blue-500/70' : 'bg-emerald-950/80 border-emerald-500/70') :
        data.status === 'failed' ? 'bg-red-950/60 border-red-500/60' :
        isProd ? 'bg-[#0f1e2e]/70 border-blue-700/40' : 'bg-[#0f2214]/70 border-emerald-700/40'
      }`}
      style={{ boxShadow: ip ? '0 0 20px rgba(14,165,233,0.45)' : ok ? `0 0 16px ${isProd ? 'rgba(59,130,246,0.3)' : 'rgba(16,185,129,0.3)'}` : undefined }}
    >
      <ProvisionRing active={ip} />
      <div className={`flex items-center gap-2 px-2.5 py-2 rounded-t-xl ${isProd ? 'bg-blue-900/40' : 'bg-emerald-900/40'}`}>
        <MonitorPlay className={`w-3.5 h-3.5 shrink-0 ${isProd ? 'text-blue-400' : 'text-emerald-400'}`} />
        <span className={`text-[11px] font-bold truncate flex-1 ${isProd ? 'text-blue-100' : 'text-emerald-100'}`}>{data.label}</span>
        <StatusIcon status={data.status} />
      </div>
      <div className="px-2.5 py-1.5">
        <span className={`text-[9px] font-medium ${isProd ? 'text-blue-400' : 'text-emerald-400'}`}>{isProd ? 'Producer' : 'Consumer'} · Target</span>
      </div>
      <Handle type="source" position={Position.Right} className={`!w-2.5 !h-2.5 !border-2 ${isProd ? '!bg-blue-500 !border-blue-300' : '!bg-emerald-500 !border-emerald-300'}`} />
      <Handle type="target" position={Position.Left}  className={`!w-2.5 !h-2.5 !border-2 ${isProd ? '!bg-blue-500 !border-blue-300' : '!bg-emerald-500 !border-emerald-300'}`} />
    </motion.div>
  );
}

function TgtQMNode({ data }: { data: TgtData }) {
  const ip = data.status === 'provisioning';
  const ok = data.status === 'success';
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.75, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      className={`relative rounded-xl border-2 shadow-xl min-w-[162px] ${
        ip ? 'bg-sky-950/80 border-sky-500/70' :
        ok ? 'bg-[#0e1e1a] border-teal-500/70' :
        data.status === 'failed' ? 'bg-red-950/60 border-red-500/60' :
        'bg-[#0e1a28]/70 border-teal-600/40'
      }`}
      style={{ boxShadow: ip ? '0 0 22px rgba(14,165,233,0.5)' : ok ? '0 0 18px rgba(20,184,166,0.35)' : undefined }}
    >
      <ProvisionRing active={ip} />
      <div className="flex items-center gap-2 px-2.5 py-2 rounded-t-xl bg-teal-900/50">
        <Server className="w-3.5 h-3.5 shrink-0 text-teal-400" />
        <span className="text-[11px] font-bold truncate text-teal-100 flex-1">{data.label}</span>
        <StatusIcon status={data.status} />
      </div>
      <div className="px-2.5 py-2 space-y-1">
        <span className="text-[9px] text-teal-400 font-medium">QM · Target</span>
        {(data.queues || []).length > 0 && (
          <div className="space-y-0.5 mt-1">
            {(data.queues || []).map(q => (
              <div key={q.name} className="flex items-center gap-1.5 text-[9px]">
                <span className={`w-1 h-1 rounded-full shrink-0 ${q.type === 'xmit' ? 'bg-sky-400' : 'bg-slate-500'}`} />
                <span className="font-mono text-slate-400 truncate">{q.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-teal-500 !w-2.5 !h-2.5 !border-2 !border-teal-300" />
      <Handle type="target" position={Position.Left}  className="!bg-teal-500 !w-2.5 !h-2.5 !border-2 !border-teal-300" />
    </motion.div>
  );
}

function TgtChannelNode({ data }: { data: TgtData }) {
  const ip = data.status === 'provisioning';
  const ok = data.status === 'success';
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.75, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      className={`relative flex flex-col items-center gap-1 px-2.5 py-2 rounded-xl border-2 shadow-lg min-w-[115px] ${
        ip ? 'bg-sky-950/70 border-sky-500/70' :
        ok ? 'bg-[#1c1510]/80 border-amber-500/70' :
        'bg-[#1c1510]/80 border-amber-700/40'
      }`}
      style={{ boxShadow: ip ? '0 0 18px rgba(14,165,233,0.45)' : ok ? '0 0 14px rgba(245,158,11,0.3)' : undefined }}
    >
      <ProvisionRing active={ip} />
      <div className="flex items-center gap-1.5 w-full">
        <div className="w-6 h-6 rounded-lg bg-amber-900/60 flex items-center justify-center shrink-0">
          <GitBranch className="w-3 h-3 text-amber-400" />
        </div>
        <span className="text-[10px] font-bold text-amber-100 truncate flex-1">{data.label}</span>
        <StatusIcon status={data.status} />
      </div>
      <span className="text-[8px] text-amber-400 font-medium">Channel · Target</span>
      <Handle type="source" position={Position.Right} className="!bg-amber-500 !w-2.5 !h-2.5 !border-2 !border-amber-300" />
      <Handle type="target" position={Position.Left}  className="!bg-amber-500 !w-2.5 !h-2.5 !border-2 !border-amber-300" />
    </motion.div>
  );
}

// ── Node type registries ──────────────────────────────────────────────────────

const SRC_NODE_TYPES = { appNode: SrcAppNode, qmNode: SrcQMNode, channelNode: SrcChannelNode };
const TGT_NODE_TYPES = { appNode: TgtAppNode, qmNode: TgtQMNode, channelNode: TgtChannelNode };

// ── Layout builders ───────────────────────────────────────────────────────────

function buildSrcLayout(
  migratedIds: Set<string>,
  hoveredId: string | null,
  onMigrateMap: Record<string, () => void>
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = SOURCE_NODES.map(n => ({
    id: n.id,
    type: RF_TYPE[n.id] || 'appNode',
    position: NODE_POSITIONS[n.id] || { x: 0, y: 0 },
    selectable: false,
    draggable: false,
    data: {
      ...n,
      migrated: migratedIds.has(n.id),
      hovered: hoveredId === n.id,
      onMigrate: onMigrateMap[n.id] || (() => {}),
    } as SrcData,
  }));

  const edges: Edge[] = SOURCE_EDGES.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    animated: e.kind === 'channel',
    markerEnd: { type: MarkerType.ArrowClosed, color: e.kind === 'channel' ? '#b45309' : '#475569' },
    style: {
      stroke: e.kind === 'channel' ? '#b45309' : '#334155',
      strokeWidth: e.kind === 'channel' ? 2 : 1.5,
      opacity: 0.85,
    },
  }));

  return { nodes, edges };
}

function buildTgtLayout(states: Record<string, TargetNodeState>): { nodes: Node[]; edges: Edge[] } {
  const ids = Object.keys(states);

  const nodes: Node[] = ids.map(id => {
    const src = SOURCE_NODES.find(n => n.id === id);
    if (!src) return null;
    return {
      id: `t-${id}`,
      type: RF_TYPE[id] || 'appNode',
      position: NODE_POSITIONS[id] || { x: 0, y: 0 },
      selectable: false,
      draggable: false,
      data: { ...src, status: states[id].status } as TgtData,
    };
  }).filter(Boolean) as Node[];

  const edges: Edge[] = SOURCE_EDGES
    .filter(e => ids.includes(e.source) && ids.includes(e.target))
    .map(e => {
      const srcOk = states[e.source]?.status === 'success';
      const tgtOk = states[e.target]?.status === 'success';
      const live = srcOk && tgtOk;
      return {
        id: `t-${e.id}`,
        source: `t-${e.source}`,
        target: `t-${e.target}`,
        animated: live && e.kind === 'channel',
        markerEnd: { type: MarkerType.ArrowClosed, color: live ? (e.kind === 'channel' ? '#10b981' : '#14b8a6') : '#374151' },
        style: {
          stroke: live ? (e.kind === 'channel' ? '#059669' : '#0d9488') : '#374151',
          strokeWidth: live && e.kind === 'channel' ? 2.5 : 1.5,
          opacity: live ? 0.9 : 0.3,
          strokeDasharray: live ? undefined : '4 3',
        },
      };
    });

  return { nodes, edges };
}

// ── FlowDivider ───────────────────────────────────────────────────────────────

function FlowDivider({ active }: { active: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 w-11 shrink-0 py-8 select-none">
      <div className="w-px flex-1 rounded-full"
        style={{ background: active ? 'linear-gradient(180deg,rgba(14,165,233,0.04),rgba(14,165,233,0.55),rgba(14,165,233,0.04))' : 'rgba(255,255,255,0.05)' }} />
      <div className="flex flex-col items-center gap-1 py-1">
        {[0, 1, 2].map(i => (
          <motion.div key={i}
            animate={active ? { opacity: [0.2, 1, 0.2], x: [0, 3, 0] } : { opacity: 0.12 }}
            transition={active ? { duration: 0.85, repeat: Infinity, delay: i * 0.2 } : {}}>
            <ArrowRight className="w-3.5 h-3.5" style={{ color: active ? '#38BDF8' : '#1e293b' }} />
          </motion.div>
        ))}
      </div>
      <div className="w-px flex-1 rounded-full"
        style={{ background: active ? 'linear-gradient(180deg,rgba(14,165,233,0.55),rgba(14,165,233,0.04),rgba(14,165,233,0.04))' : 'rgba(255,255,255,0.05)' }} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  onMigrationComplete?: (nodeIds: string[]) => void;
}

export default function LiveTopologyMigrationBoard({ onMigrationComplete }: Props) {
  const [migratedIds, setMigratedIds] = useState<Set<string>>(new Set());
  const [targetStates, setTargetStates] = useState<Record<string, TargetNodeState>>({});
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const provisioningCount = Object.values(targetStates).filter(n => n.status === 'provisioning').length;
  const successCount      = Object.values(targetStates).filter(n => n.status === 'success').length;
  const allMigrated       = migratedIds.size >= SOURCE_NODES.length;

  // ── Provision logic ─────────────────────────────────────────────────────────

  const simulateProvisioning = useCallback((ids: string[]) => {
    ids.forEach((id, idx) => {
      setTimeout(() => {
        setTargetStates(prev => ({ ...prev, [id]: { ...prev[id], status: 'provisioning', log: ['Simulating…'] } }));
        setTimeout(() => {
          setTargetStates(prev => ({ ...prev, [id]: { ...prev[id], status: 'success', log: [...(prev[id]?.log || []), 'Done (simulated)'] } }));
        }, 600 + Math.random() * 500);
      }, idx * 380);
    });
  }, []);

  const handleProvisionEvent = useCallback((event: ProvisionEvent, ids: string[]) => {
    if (event.type === 'node_provisioning' && event.node_id) {
      const m = ids.find(id => id === event.node_id || SOURCE_NODES.find(n => n.id === id)?.label === event.label);
      if (m) setTargetStates(prev => ({ ...prev, [m]: { ...prev[m], status: 'provisioning', log: [...(prev[m]?.log || []), `Provisioning…`] } }));
    } else if (event.type === 'node_provisioned' && event.node_id) {
      const m = ids.find(id => id === event.node_id || SOURCE_NODES.find(n => n.id === id)?.label === event.label);
      if (m) setTargetStates(prev => ({ ...prev, [m]: { ...prev[m], status: event.status === 'success' ? 'success' : 'failed', log: [...(prev[m]?.log || []), event.status === 'success' ? 'Provisioned' : 'Failed'] } }));
    } else if (event.type === 'complete') {
      setTargetStates(prev => {
        const u = { ...prev };
        ids.forEach(id => { if (u[id] && u[id].status !== 'success') u[id] = { ...u[id], status: 'success', log: [...u[id].log, 'Done'] }; });
        return u;
      });
      onMigrationComplete?.(ids);
    }
  }, [onMigrationComplete]);

  const migrateNodes = useCallback(async (toAdd: string[]) => {
    setMigratedIds(prev => new Set([...prev, ...toAdd]));
    const init: Record<string, TargetNodeState> = {};
    toAdd.forEach(id => { init[id] = { id, status: 'pending', log: [] }; });
    setTargetStates(prev => ({ ...prev, ...init }));

    try {
      const { session_id } = await startProvisioning();
      setTargetStates(prev => {
        const u = { ...prev };
        toAdd.forEach(id => { if (u[id]) u[id] = { ...u[id], status: 'provisioning' }; });
        return u;
      });

      const es = openProvisionEventStream(session_id);
      es.onmessage = evt => { try { handleProvisionEvent(JSON.parse(evt.data), toAdd); } catch { /* ignore */ } };
      es.onerror = () => {
        setTargetStates(prev => {
          const u = { ...prev };
          toAdd.forEach(id => { if (u[id] && u[id].status !== 'success') u[id] = { ...u[id], status: 'failed', log: [...u[id].log, 'Conn error – simulated'] }; });
          return u;
        });
        setTimeout(() => {
          setTargetStates(prev => {
            const u = { ...prev };
            toAdd.forEach(id => { if (u[id]?.status === 'failed') u[id] = { ...u[id], status: 'success', log: [...u[id].log, 'Simulated OK'] }; });
            return u;
          });
        }, 1500);
      };
    } catch {
      simulateProvisioning(toAdd);
    }
  }, [handleProvisionEvent, simulateProvisioning]);

  const handleMigrateNode = useCallback((nodeId: string) => {
    if (migratedIds.has(nodeId)) return;
    const related = RELATED_MAP[nodeId] || [];
    const toAdd = [nodeId, ...related].filter(id => !migratedIds.has(id));
    if (toAdd.length > 0) migrateNodes(toAdd);
  }, [migratedIds, migrateNodes]);

  const handleMigrateAll = useCallback(() => {
    const toAdd = SOURCE_NODES.map(n => n.id).filter(id => !migratedIds.has(id));
    if (toAdd.length > 0) migrateNodes(toAdd);
  }, [migratedIds, migrateNodes]);

  // Per-node migrate callbacks (stable map, rebuilt when migratedIds changes)
  const onMigrateMap = useMemo(() => {
    const m: Record<string, () => void> = {};
    SOURCE_NODES.forEach(n => { m[n.id] = () => handleMigrateNode(n.id); });
    return m;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify([...migratedIds])]);

  // ── Source React Flow ────────────────────────────────────────────────────────

  const srcLayout = useMemo(
    () => buildSrcLayout(migratedIds, hoveredId, onMigrateMap),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [JSON.stringify([...migratedIds]), hoveredId, onMigrateMap]);

  const [srcNodes, setSrcNodes, onSrcNodesChange] = useNodesState(srcLayout.nodes);
  const [srcEdges, setSrcEdges, onSrcEdgesChange] = useEdgesState(srcLayout.edges);

  useEffect(() => {
    const l = buildSrcLayout(migratedIds, hoveredId, onMigrateMap);
    setSrcNodes(l.nodes);
    setSrcEdges(l.edges);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify([...migratedIds]), hoveredId, onMigrateMap]);

  // ── Target React Flow ────────────────────────────────────────────────────────

  const tgtLayout = useMemo(
    () => buildTgtLayout(targetStates),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [JSON.stringify(targetStates)]);

  const [tgtNodes, setTgtNodes, onTgtNodesChange] = useNodesState(tgtLayout.nodes);
  const [tgtEdges, setTgtEdges, onTgtEdgesChange] = useEdgesState(tgtLayout.edges);

  useEffect(() => {
    const l = buildTgtLayout(targetStates);
    setTgtNodes(l.nodes);
    setTgtEdges(l.edges);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(targetStates)]);

  const onSrcNodeMouseEnter = useCallback((_: React.MouseEvent, node: Node) => setHoveredId(node.id), []);
  const onSrcNodeMouseLeave = useCallback(() => setHoveredId(null), []);
  const onSrcNodeClick      = useCallback((_: React.MouseEvent, node: Node) => {
    if (!(node.data as SrcData).migrated) handleMigrateNode(node.id);
  }, [handleMigrateNode]);

  const hasTarget = Object.keys(targetStates).length > 0;

  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(8,12,22,0.85)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 4px 40px rgba(0,0,0,0.5)',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3.5 flex-wrap gap-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,rgba(14,165,233,0.2),rgba(2,132,199,0.1))', border: '1px solid rgba(14,165,233,0.3)' }}>
            <Zap className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white leading-tight">Live Topology Migration</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <MousePointerClick className="w-3 h-3 text-slate-500" />
              <p className="text-[10px] text-slate-500">Click any source node to migrate it to the target topology</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Stats */}
          {[
            { dot: '#64748B', label: 'Total',        value: SOURCE_NODES.length },
            { dot: '#38BDF8', label: 'Provisioning', value: provisioningCount },
            { dot: '#10B981', label: 'Success',       value: successCount },
          ].map(({ dot, label, value }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />
              <span className="text-[10px] text-slate-500">{label}</span>
              <span className="text-[10px] font-mono font-semibold" style={{ color: dot }}>{value}</span>
            </div>
          ))}

          {/* Migrate all */}
          {!allMigrated && (
            <motion.button
              onClick={handleMigrateAll}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-sky-300 transition-all"
              style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.3)' }}
            >
              <ChevronsRight className="w-3.5 h-3.5" />
              Migrate All
            </motion.button>
          )}

          {allMigrated && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold text-emerald-400"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}
            >
              <CheckCircle2 className="w-3 h-3" /> All nodes migrated
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Panels ─────────────────────────────────────────────────────────── */}
      <div className="flex items-stretch" style={{ height: 500 }}>

        {/* Source panel */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-2 px-4 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span className="w-2 h-2 rounded-full bg-violet-400" />
            <span className="text-xs font-semibold text-slate-300">Source Topology</span>
            <span className="ml-auto text-[10px] text-slate-600 font-mono">{migratedIds.size}/{SOURCE_NODES.length} migrated</span>
          </div>
          <div className="flex-1 relative">
            <ReactFlow
              nodes={srcNodes}
              edges={srcEdges}
              onNodesChange={onSrcNodesChange}
              onEdgesChange={onSrcEdgesChange}
              nodeTypes={SRC_NODE_TYPES}
              fitView
              fitViewOptions={{ padding: 0.18 }}
              minZoom={0.2}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
              nodesDraggable={false}
              nodesConnectable={false}
              onNodeMouseEnter={onSrcNodeMouseEnter}
              onNodeMouseLeave={onSrcNodeMouseLeave}
              onNodeClick={onSrcNodeClick}
              className="bg-transparent"
            >
              <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="rgba(100,116,139,0.1)" />
              <Controls
                showInteractive={false}
                className="!bg-[#0d1220]/90 !border-slate-700/50 !rounded-xl overflow-hidden !shadow-xl"
                style={{ bottom: 8, left: 8, top: 'auto', right: 'auto' }}
              />
              <MiniMap
                nodeColor={n => n.type === 'appNode' ? '#3b82f6' : n.type === 'qmNode' ? '#7c3aed' : '#f59e0b'}
                maskColor="rgba(8,11,20,0.7)"
                className="!rounded-xl !overflow-hidden"
                style={{ background: 'rgba(8,11,20,0.9)', border: '1px solid rgba(100,116,139,0.2)', bottom: 8, right: 8 }}
              />
            </ReactFlow>

            {/* Legend */}
            <div className="absolute top-2 left-2 flex flex-col gap-1 pointer-events-none">
              {[
                { color: '#3b82f6', label: 'Producer App' },
                { color: '#10b981', label: 'Consumer App' },
                { color: '#7c3aed', label: 'Queue Manager' },
                { color: '#f59e0b', label: 'Channel' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] text-slate-400"
                  style={{ background: 'rgba(8,12,22,0.85)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Divider */}
        <FlowDivider active={provisioningCount > 0 || (migratedIds.size > 0 && successCount < migratedIds.size)} />

        {/* Target panel */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-2 px-4 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span className="w-2 h-2 rounded-full bg-teal-400" />
            <span className="text-xs font-semibold text-slate-300">Target Topology</span>
            {provisioningCount > 0 && (
              <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1, repeat: Infinity }}
                className="text-[10px] text-sky-400 font-medium ml-1">
                Provisioning...
              </motion.span>
            )}
            {successCount > 0 && provisioningCount === 0 && (
              <span className="text-[10px] text-emerald-400 font-medium ml-1">{successCount} provisioned</span>
            )}
          </div>

          <div className="flex-1 relative">
            {hasTarget ? (
              <ReactFlow
                nodes={tgtNodes}
                edges={tgtEdges}
                onNodesChange={onTgtNodesChange}
                onEdgesChange={onTgtEdgesChange}
                nodeTypes={TGT_NODE_TYPES}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.2}
                maxZoom={2}
                proOptions={{ hideAttribution: true }}
                nodesDraggable={false}
                nodesConnectable={false}
                className="bg-transparent"
              >
                <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="rgba(100,116,139,0.1)" />
                <Controls
                  showInteractive={false}
                  className="!bg-[#0d1220]/90 !border-slate-700/50 !rounded-xl overflow-hidden !shadow-xl"
                  style={{ bottom: 8, left: 8, top: 'auto', right: 'auto' }}
                />
                <MiniMap
                  nodeColor={n => {
                    const d = n.data as TgtData;
                    if (d.status === 'success') return '#10b981';
                    if (d.status === 'provisioning') return '#38bdf8';
                    if (d.status === 'failed') return '#ef4444';
                    return '#475569';
                  }}
                  maskColor="rgba(8,11,20,0.7)"
                  className="!rounded-xl !overflow-hidden"
                  style={{ background: 'rgba(8,11,20,0.9)', border: '1px solid rgba(100,116,139,0.2)', bottom: 8, right: 8 }}
                />
              </ReactFlow>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '2px dashed rgba(255,255,255,0.08)' }}>
                  <PackageOpen className="w-8 h-8 text-slate-700" />
                </div>
                <div className="text-center space-y-1.5">
                  <p className="text-sm font-medium text-slate-500">Target Topology Empty</p>
                  <p className="text-xs text-slate-700">Click a source node to migrate it here</p>
                  <p className="text-xs text-slate-700">or use <span className="text-sky-600">Migrate All</span></p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
