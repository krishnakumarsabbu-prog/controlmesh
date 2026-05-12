import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
} from 'lucide-react';
import { startProvisioning, openProvisionEventStream } from '../../api/topologyUpload';
import type { ProvisionEvent } from '../../api/topologyUpload';

// ── Source topology data ─────────────────────────────────────────────────────

interface SourceNode {
  id: string;
  type: 'qm' | 'app' | 'channel' | 'queue';
  label: string;
  role?: 'producer' | 'consumer' | 'source' | 'target';
  queueType?: 'local' | 'remote' | 'xmit';
  parentQm?: string;
  appId?: string;
  neighborhood?: string;
  queues?: Array<{ name: string; type: 'local' | 'remote' | 'xmit' }>;
}

type ProvisionStatus = 'pending' | 'provisioning' | 'success' | 'failed';

interface TargetNodeState {
  id: string;
  status: ProvisionStatus;
  log: string[];
}

const SOURCE_NODES: SourceNode[] = [
  { id: 'app_order_svc', type: 'app', label: 'APP.ORDER.SVC', role: 'producer', neighborhood: 'orders', appId: 'APP.ORDER.SVC' },
  { id: 'app_notify_svc', type: 'app', label: 'APP.NOTIFY.SVC', role: 'producer', neighborhood: 'notify', appId: 'APP.NOTIFY.SVC' },
  {
    id: 'qm_src_a', type: 'qm', label: 'QM.SRC.A', role: 'source',
    queues: [
      { name: 'ORDERS.LOCAL', type: 'local' },
      { name: 'ORDERS.REPLY', type: 'local' },
      { name: 'ORDERS.DLQ', type: 'local' },
      { name: 'NOTIFY.LOCAL', type: 'local' },
      { name: 'XMIT.APP.A', type: 'xmit' },
    ],
  },
  {
    id: 'qm_src_b', type: 'qm', label: 'QM.SRC.B', role: 'source',
    queues: [
      { name: 'PAYMENT.LOCAL', type: 'local' },
      { name: 'PAYMENT.DLQ', type: 'local' },
      { name: 'XMIT.APP.B', type: 'xmit' },
    ],
  },
  { id: 'ch_chnl_src_app', type: 'channel', label: 'CHNL.SRC.APP', parentQm: 'QM.SRC.A' },
  { id: 'ch_chnl_src_pay', type: 'channel', label: 'CHNL.SRC.PAY', parentQm: 'QM.SRC.B' },
  { id: 'app_fulfillment', type: 'app', label: 'APP.FULFILLMENT', role: 'consumer', neighborhood: 'fulfillment', appId: 'APP.FULFILLMENT' },
  { id: 'app_payment_svc', type: 'app', label: 'APP.PAYMENT.SVC', role: 'consumer', neighborhood: 'payment', appId: 'APP.PAYMENT.SVC' },
];

// Source edges: app_order_svc → qm_src_a → ch_chnl_src_app → app_fulfillment
//               app_notify_svc → qm_src_a
//               app_payment_svc → qm_src_b → ch_chnl_src_pay → app_fulfillment
const SOURCE_EDGES = [
  { id: 'e1', source: 'app_order_svc', target: 'qm_src_a', type: 'app' },
  { id: 'e2', source: 'app_notify_svc', target: 'qm_src_a', type: 'app' },
  { id: 'e3', source: 'qm_src_a', target: 'ch_chnl_src_app', type: 'channel' },
  { id: 'e4', source: 'ch_chnl_src_app', target: 'app_fulfillment', type: 'channel' },
  { id: 'e5', source: 'app_payment_svc', target: 'qm_src_b', type: 'app' },
  { id: 'e6', source: 'qm_src_b', target: 'ch_chnl_src_pay', type: 'channel' },
  { id: 'e7', source: 'ch_chnl_src_pay', target: 'app_fulfillment', type: 'channel' },
];

// Related nodes that come along when a primary node is migrated
const RELATED_MAP: Record<string, string[]> = {
  qm_src_a: ['ch_chnl_src_app', 'app_order_svc', 'app_notify_svc', 'app_fulfillment'],
  qm_src_b: ['ch_chnl_src_pay', 'app_payment_svc'],
  app_order_svc: ['qm_src_a'],
  app_notify_svc: ['qm_src_a'],
  app_fulfillment: ['qm_src_a'],
  app_payment_svc: ['qm_src_b'],
  ch_chnl_src_app: ['qm_src_a'],
  ch_chnl_src_pay: ['qm_src_b'],
};

// ── Custom React Flow node components ────────────────────────────────────────

interface SourceNodeData extends SourceNode {
  migrated?: boolean;
  highlighted?: boolean;
  dimmed?: boolean;
  onDragStart?: () => void;
}

function SrcAppNode({ data }: { data: SourceNodeData }) {
  const isProd = data.role === 'producer';
  const isDimmed = data.dimmed && !data.highlighted;
  const isMigrated = data.migrated;

  return (
    <motion.div
      animate={isMigrated ? { opacity: 0.3 } : isDimmed ? { opacity: 0.35 } : { opacity: 1 }}
      transition={{ duration: 0.3 }}
      draggable={!isMigrated}
      onDragStart={data.onDragStart}
      className={`relative rounded-xl border-2 shadow-lg min-w-[130px] select-none ${
        isMigrated ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
      } ${
        isProd
          ? 'bg-[#0f1e2e] border-blue-600/70'
          : 'bg-[#0f2214] border-emerald-600/70'
      } ${data.highlighted ? 'ring-2 ring-white/30' : ''}`}
      style={{
        boxShadow: data.highlighted ? `0 0 20px ${isProd ? 'rgba(59,130,246,0.5)' : 'rgba(16,185,129,0.5)'}` : undefined,
        filter: isMigrated ? 'grayscale(70%)' : 'none',
      }}
    >
      <div className={`flex items-center gap-2 px-2.5 py-2 rounded-t-xl ${isProd ? 'bg-blue-900/40' : 'bg-emerald-900/40'}`}>
        <MonitorPlay className={`w-3.5 h-3.5 shrink-0 ${isProd ? 'text-blue-400' : 'text-emerald-400'}`} />
        <span className={`text-[11px] font-bold truncate tracking-wide ${isProd ? 'text-blue-100' : 'text-emerald-100'}`}>
          {data.label}
        </span>
        {isMigrated && <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 ml-auto" />}
      </div>
      <div className="px-2.5 py-1.5">
        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
          isProd ? 'bg-blue-900/50 text-blue-300' : 'bg-emerald-900/50 text-emerald-300'
        }`}>
          {isProd ? 'Producer' : 'Consumer'}
        </span>
        {data.neighborhood && (
          <div className="text-[9px] text-slate-500 mt-1 font-mono">{data.neighborhood}</div>
        )}
      </div>
      {!isMigrated && (
        <div className="absolute left-1 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 opacity-25 pointer-events-none">
          {[0,1,2].map(i => <span key={i} className="w-1 h-1 rounded-full bg-white" />)}
        </div>
      )}
      <Handle type="source" position={Position.Right} className={`!w-2.5 !h-2.5 !border-2 ${isProd ? '!bg-blue-500 !border-blue-300' : '!bg-emerald-500 !border-emerald-300'}`} />
      <Handle type="target" position={Position.Left} className={`!w-2.5 !h-2.5 !border-2 ${isProd ? '!bg-blue-500 !border-blue-300' : '!bg-emerald-500 !border-emerald-300'}`} />
    </motion.div>
  );
}

function SrcQMNode({ data }: { data: SourceNodeData }) {
  const isSource = data.role === 'source';
  const isDimmed = data.dimmed && !data.highlighted;
  const isMigrated = data.migrated;
  const localQ = (data.queues || []).filter(q => q.type === 'local').length;
  const remoteQ = (data.queues || []).filter(q => q.type === 'remote').length;
  const xmitQ = (data.queues || []).filter(q => q.type === 'xmit').length;

  return (
    <motion.div
      animate={isMigrated ? { opacity: 0.3 } : isDimmed ? { opacity: 0.35 } : { opacity: 1 }}
      transition={{ duration: 0.3 }}
      draggable={!isMigrated}
      onDragStart={data.onDragStart}
      className={`relative rounded-xl border-2 shadow-xl min-w-[155px] select-none ${
        isMigrated ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
      } ${
        isSource ? 'bg-[#13102a] border-violet-600/70' : 'bg-[#0e1a28] border-teal-600/70'
      } ${data.highlighted ? 'ring-2 ring-white/30' : ''}`}
      style={{
        boxShadow: data.highlighted ? 'rgba(167,139,250,0.5) 0 0 20px' : '0 4px 16px rgba(0,0,0,0.5)',
        filter: isMigrated ? 'grayscale(70%)' : 'none',
      }}
    >
      <div className={`flex items-center gap-2 px-2.5 py-2 rounded-t-xl ${isSource ? 'bg-violet-900/50' : 'bg-teal-900/50'}`}>
        <Server className={`w-3.5 h-3.5 shrink-0 ${isSource ? 'text-violet-400' : 'text-teal-400'}`} />
        <span className={`text-[11px] font-bold truncate tracking-wide flex-1 ${isSource ? 'text-violet-100' : 'text-teal-100'}`}>
          {data.label}
        </span>
        {isMigrated && <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />}
      </div>
      <div className="px-2.5 py-2 space-y-1.5">
        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${isSource ? 'bg-violet-900/50 text-violet-300' : 'bg-teal-900/50 text-teal-300'}`}>
          QM {isSource ? '(Source)' : '(Target)'}
        </span>
        {(data.queues || []).length > 0 && (
          <div className="space-y-0.5 mt-1">
            {(data.queues || []).map(q => (
              <div key={q.name} className="flex items-center gap-1.5 text-[10px]">
                <span className={`w-1 h-1 rounded-full shrink-0 ${
                  q.type === 'xmit' ? 'bg-sky-400' : q.type === 'remote' ? 'bg-amber-400' : 'bg-slate-500'
                }`} />
                <span className={`font-mono truncate ${
                  q.type === 'xmit' ? 'text-sky-300/80' : q.type === 'remote' ? 'text-amber-300/80' : 'text-slate-400'
                }`}>{q.name}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1 flex-wrap pt-0.5">
          {localQ > 0 && <span className="text-[8px] px-1 py-0.5 rounded bg-slate-700/60 text-slate-300">{localQ}L</span>}
          {remoteQ > 0 && <span className="text-[8px] px-1 py-0.5 rounded bg-amber-900/60 text-amber-300">{remoteQ}R</span>}
          {xmitQ > 0 && <span className="text-[8px] px-1 py-0.5 rounded bg-sky-900/60 text-sky-300">{xmitQ}X</span>}
        </div>
      </div>
      {!isMigrated && (
        <div className="absolute left-1 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 opacity-25 pointer-events-none">
          {[0,1,2].map(i => <span key={i} className="w-1 h-1 rounded-full bg-white" />)}
        </div>
      )}
      <Handle type="source" position={Position.Right} className={`!w-2.5 !h-2.5 !border-2 ${isSource ? '!bg-violet-500 !border-violet-300' : '!bg-teal-500 !border-teal-300'}`} />
      <Handle type="target" position={Position.Left} className={`!w-2.5 !h-2.5 !border-2 ${isSource ? '!bg-violet-500 !border-violet-300' : '!bg-teal-500 !border-teal-300'}`} />
    </motion.div>
  );
}

function SrcChannelNode({ data }: { data: SourceNodeData }) {
  const isDimmed = data.dimmed && !data.highlighted;
  const isMigrated = data.migrated;

  return (
    <motion.div
      animate={isMigrated ? { opacity: 0.3 } : isDimmed ? { opacity: 0.35 } : { opacity: 1 }}
      transition={{ duration: 0.3 }}
      draggable={!isMigrated}
      onDragStart={data.onDragStart}
      className={`relative flex flex-col items-center gap-1 px-2.5 py-2 rounded-xl border-2 shadow-lg min-w-[110px] select-none ${
        isMigrated ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
      } bg-[#1c1510] border-amber-600/60 ${data.highlighted ? 'ring-2 ring-white/30' : ''}`}
      style={{
        boxShadow: data.highlighted ? '0 0 20px rgba(245,158,11,0.4)' : undefined,
        filter: isMigrated ? 'grayscale(70%)' : 'none',
      }}
    >
      <div className="flex items-center gap-1.5 w-full">
        <div className="w-6 h-6 rounded-lg bg-amber-900/60 flex items-center justify-center shrink-0">
          <GitBranch className="w-3 h-3 text-amber-400" />
        </div>
        <span className="text-[10px] font-bold text-amber-100 truncate flex-1">{data.label}</span>
        {isMigrated && <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />}
      </div>
      <span className="text-[8px] text-amber-400 font-medium">Channel</span>
      {data.parentQm && <span className="text-[8px] text-amber-500/60 font-mono truncate w-full text-center">via {data.parentQm}</span>}
      <Handle type="source" position={Position.Right} className="!bg-amber-500 !w-2.5 !h-2.5 !border-2 !border-amber-300" />
      <Handle type="target" position={Position.Left} className="!bg-amber-500 !w-2.5 !h-2.5 !border-2 !border-amber-300" />
    </motion.div>
  );
}

// ── Target topology node types ────────────────────────────────────────────────

interface TargetNodeData extends SourceNode {
  status: ProvisionStatus;
  log: string[];
}

function TgtAppNode({ data }: { data: TargetNodeData }) {
  const isProd = data.role === 'producer';
  const statusColor = {
    pending: 'border-slate-600/60',
    provisioning: 'border-sky-500/70',
    success: 'border-emerald-500/70',
    failed: 'border-red-500/60',
  }[data.status];

  const glow = {
    pending: 'none',
    provisioning: '0 0 18px rgba(14,165,233,0.45)',
    success: '0 0 16px rgba(16,185,129,0.35)',
    failed: '0 0 14px rgba(239,68,68,0.3)',
  }[data.status];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative rounded-xl border-2 shadow-lg min-w-[130px] ${
        data.status === 'provisioning' ? (isProd ? 'bg-sky-950/80' : 'bg-sky-950/80') :
        data.status === 'success' ? (isProd ? 'bg-blue-950/90' : 'bg-emerald-950/80') :
        data.status === 'failed' ? 'bg-red-950/60' :
        isProd ? 'bg-[#0f1e2e]/70' : 'bg-[#0f2214]/70'
      } ${statusColor}`}
      style={{ boxShadow: glow }}
    >
      {data.status === 'provisioning' && (
        <motion.div
          className="absolute inset-0 rounded-xl border-2 border-sky-400/40 pointer-events-none"
          animate={{ opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
      )}
      <div className={`flex items-center gap-2 px-2.5 py-2 rounded-t-xl ${isProd ? 'bg-blue-900/40' : 'bg-emerald-900/40'}`}>
        <MonitorPlay className={`w-3.5 h-3.5 shrink-0 ${isProd ? 'text-blue-400' : 'text-emerald-400'}`} />
        <span className={`text-[11px] font-bold truncate flex-1 ${isProd ? 'text-blue-100' : 'text-emerald-100'}`}>{data.label}</span>
        <StatusIcon status={data.status} />
      </div>
      <div className="px-2.5 py-1.5">
        <span className={`text-[9px] font-medium ${isProd ? 'text-blue-400' : 'text-emerald-400'}`}>
          {isProd ? 'Producer' : 'Consumer'} · Target
        </span>
      </div>
      <Handle type="source" position={Position.Right} className={`!w-2.5 !h-2.5 !border-2 ${isProd ? '!bg-blue-500 !border-blue-300' : '!bg-emerald-500 !border-emerald-300'}`} />
      <Handle type="target" position={Position.Left} className={`!w-2.5 !h-2.5 !border-2 ${isProd ? '!bg-blue-500 !border-blue-300' : '!bg-emerald-500 !border-emerald-300'}`} />
    </motion.div>
  );
}

function TgtQMNode({ data }: { data: TargetNodeData }) {
  const statusColor = {
    pending: 'border-slate-600/60',
    provisioning: 'border-sky-500/70',
    success: 'border-teal-500/70',
    failed: 'border-red-500/60',
  }[data.status];

  const glow = {
    pending: 'none',
    provisioning: '0 0 22px rgba(14,165,233,0.5)',
    success: '0 0 18px rgba(20,184,166,0.4)',
    failed: '0 0 14px rgba(239,68,68,0.3)',
  }[data.status];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative rounded-xl border-2 shadow-xl min-w-[155px] ${
        data.status === 'provisioning' ? 'bg-sky-950/80' :
        data.status === 'success' ? 'bg-[#0e1e1a]' :
        data.status === 'failed' ? 'bg-red-950/60' :
        'bg-[#0e1a28]/70'
      } border-teal-600/60 ${statusColor}`}
      style={{ boxShadow: glow }}
    >
      {data.status === 'provisioning' && (
        <motion.div
          className="absolute inset-0 rounded-xl border-2 border-sky-400/40 pointer-events-none"
          animate={{ opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 1.1, repeat: Infinity }}
        />
      )}
      <div className="flex items-center gap-2 px-2.5 py-2 rounded-t-xl bg-teal-900/50">
        <Server className="w-3.5 h-3.5 shrink-0 text-teal-400" />
        <span className="text-[11px] font-bold truncate text-teal-100 flex-1">{data.label}</span>
        <StatusIcon status={data.status} />
      </div>
      <div className="px-2.5 py-2 space-y-1">
        <span className="text-[9px] text-teal-400 font-medium">QM (Target)</span>
        {(data.queues || []).length > 0 && (
          <div className="space-y-0.5 mt-1">
            {(data.queues || []).map(q => (
              <div key={q.name} className="flex items-center gap-1.5 text-[9px]">
                <span className={`w-1 h-1 rounded-full shrink-0 ${
                  q.type === 'xmit' ? 'bg-sky-400' : q.type === 'remote' ? 'bg-amber-400' : 'bg-slate-500'
                }`} />
                <span className="font-mono text-slate-400 truncate">{q.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-teal-500 !w-2.5 !h-2.5 !border-2 !border-teal-300" />
      <Handle type="target" position={Position.Left} className="!bg-teal-500 !w-2.5 !h-2.5 !border-2 !border-teal-300" />
    </motion.div>
  );
}

function TgtChannelNode({ data }: { data: TargetNodeData }) {
  const statusColor = {
    pending: 'border-amber-700/40',
    provisioning: 'border-sky-500/70',
    success: 'border-amber-500/70',
    failed: 'border-red-500/60',
  }[data.status];

  const glow = {
    pending: 'none',
    provisioning: '0 0 18px rgba(14,165,233,0.45)',
    success: '0 0 14px rgba(245,158,11,0.35)',
    failed: '0 0 14px rgba(239,68,68,0.3)',
  }[data.status];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`flex flex-col items-center gap-1 px-2.5 py-2 rounded-xl border-2 shadow-lg min-w-[110px] relative ${
        data.status === 'provisioning' ? 'bg-sky-950/70' : 'bg-[#1c1510]/80'
      } ${statusColor}`}
      style={{ boxShadow: glow }}
    >
      {data.status === 'provisioning' && (
        <motion.div
          className="absolute inset-0 rounded-xl border-2 border-sky-400/40 pointer-events-none"
          animate={{ opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 1.3, repeat: Infinity }}
        />
      )}
      <div className="flex items-center gap-1.5 w-full">
        <div className="w-6 h-6 rounded-lg bg-amber-900/60 flex items-center justify-center shrink-0">
          <GitBranch className="w-3 h-3 text-amber-400" />
        </div>
        <span className="text-[10px] font-bold text-amber-100 truncate flex-1">{data.label}</span>
        <StatusIcon status={data.status} />
      </div>
      <span className="text-[8px] text-amber-400 font-medium">Channel · Target</span>
      <Handle type="source" position={Position.Right} className="!bg-amber-500 !w-2.5 !h-2.5 !border-2 !border-amber-300" />
      <Handle type="target" position={Position.Left} className="!bg-amber-500 !w-2.5 !h-2.5 !border-2 !border-amber-300" />
    </motion.div>
  );
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
  return <span className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" />;
}

// ── Node type registries ──────────────────────────────────────────────────────

const SOURCE_NODE_TYPES = {
  appNode: SrcAppNode,
  qmNode: SrcQMNode,
  channelNode: SrcChannelNode,
};

const TARGET_NODE_TYPES = {
  appNode: TgtAppNode,
  qmNode: TgtQMNode,
  channelNode: TgtChannelNode,
};

// ── Layout builders ───────────────────────────────────────────────────────────

function buildSourceLayout(
  migratedIds: Set<string>,
  highlightedIds: Set<string>,
  dragCallbacks: Record<string, () => void>
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    // Producer apps — left column
    { id: 'app_order_svc', type: 'appNode', position: { x: 0, y: 40 }, data: { ...SOURCE_NODES[0], migrated: migratedIds.has('app_order_svc'), highlighted: highlightedIds.has('app_order_svc'), dimmed: highlightedIds.size > 0 && !highlightedIds.has('app_order_svc'), onDragStart: dragCallbacks['app_order_svc'] } },
    { id: 'app_notify_svc', type: 'appNode', position: { x: 0, y: 195 }, data: { ...SOURCE_NODES[1], migrated: migratedIds.has('app_notify_svc'), highlighted: highlightedIds.has('app_notify_svc'), dimmed: highlightedIds.size > 0 && !highlightedIds.has('app_notify_svc'), onDragStart: dragCallbacks['app_notify_svc'] } },
    { id: 'app_payment_svc', type: 'appNode', position: { x: 0, y: 380 }, data: { ...SOURCE_NODES[7], migrated: migratedIds.has('app_payment_svc'), highlighted: highlightedIds.has('app_payment_svc'), dimmed: highlightedIds.size > 0 && !highlightedIds.has('app_payment_svc'), onDragStart: dragCallbacks['app_payment_svc'] } },
    // Source QMs — center-left
    { id: 'qm_src_a', type: 'qmNode', position: { x: 210, y: 0 }, data: { ...SOURCE_NODES[2], migrated: migratedIds.has('qm_src_a'), highlighted: highlightedIds.has('qm_src_a'), dimmed: highlightedIds.size > 0 && !highlightedIds.has('qm_src_a'), onDragStart: dragCallbacks['qm_src_a'] } },
    { id: 'qm_src_b', type: 'qmNode', position: { x: 210, y: 310 }, data: { ...SOURCE_NODES[3], migrated: migratedIds.has('qm_src_b'), highlighted: highlightedIds.has('qm_src_b'), dimmed: highlightedIds.size > 0 && !highlightedIds.has('qm_src_b'), onDragStart: dragCallbacks['qm_src_b'] } },
    // Channels — center-right
    { id: 'ch_chnl_src_app', type: 'channelNode', position: { x: 450, y: 80 }, data: { ...SOURCE_NODES[4], migrated: migratedIds.has('ch_chnl_src_app'), highlighted: highlightedIds.has('ch_chnl_src_app'), dimmed: highlightedIds.size > 0 && !highlightedIds.has('ch_chnl_src_app'), onDragStart: dragCallbacks['ch_chnl_src_app'] } },
    { id: 'ch_chnl_src_pay', type: 'channelNode', position: { x: 450, y: 330 }, data: { ...SOURCE_NODES[5], migrated: migratedIds.has('ch_chnl_src_pay'), highlighted: highlightedIds.has('ch_chnl_src_pay'), dimmed: highlightedIds.size > 0 && !highlightedIds.has('ch_chnl_src_pay'), onDragStart: dragCallbacks['ch_chnl_src_pay'] } },
    // Consumer apps — right
    { id: 'app_fulfillment', type: 'appNode', position: { x: 640, y: 175 }, data: { ...SOURCE_NODES[6], migrated: migratedIds.has('app_fulfillment'), highlighted: highlightedIds.has('app_fulfillment'), dimmed: highlightedIds.size > 0 && !highlightedIds.has('app_fulfillment'), onDragStart: dragCallbacks['app_fulfillment'] } },
  ];

  const edges: Edge[] = SOURCE_EDGES.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    animated: e.type === 'channel' && !migratedIds.has(e.source),
    markerEnd: { type: MarkerType.ArrowClosed, color: e.type === 'channel' ? '#b45309' : '#475569' },
    style: {
      stroke: e.type === 'channel' ? '#b45309' : '#334155',
      strokeWidth: e.type === 'channel' ? 2 : 1.5,
      opacity: (highlightedIds.size > 0 && !highlightedIds.has(e.source) && !highlightedIds.has(e.target)) ? 0.15 : 0.85,
    },
    labelStyle: { fontSize: 9 },
  }));

  return { nodes, edges };
}

function buildTargetLayout(
  targetStates: Record<string, TargetNodeState>
): { nodes: Node[]; edges: Edge[] } {
  const ids = Object.keys(targetStates);
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Same structural layout as source but only provisioned nodes
  const orderedIds = [
    'app_order_svc', 'app_notify_svc', 'qm_src_a', 'ch_chnl_src_app',
    'app_fulfillment', 'app_payment_svc', 'qm_src_b', 'ch_chnl_src_pay',
  ].filter(id => ids.includes(id));

  // Build positions mirroring source layout
  const posMap: Record<string, { x: number; y: number }> = {
    app_order_svc: { x: 0, y: 40 },
    app_notify_svc: { x: 0, y: 195 },
    app_payment_svc: { x: 0, y: 380 },
    qm_src_a: { x: 210, y: 0 },
    qm_src_b: { x: 210, y: 310 },
    ch_chnl_src_app: { x: 450, y: 80 },
    ch_chnl_src_pay: { x: 450, y: 330 },
    app_fulfillment: { x: 640, y: 175 },
  };

  // Type map
  const typeMap: Record<string, string> = {
    app_order_svc: 'appNode', app_notify_svc: 'appNode', app_fulfillment: 'appNode', app_payment_svc: 'appNode',
    qm_src_a: 'qmNode', qm_src_b: 'qmNode',
    ch_chnl_src_app: 'channelNode', ch_chnl_src_pay: 'channelNode',
  };

  orderedIds.forEach(id => {
    const src = SOURCE_NODES.find(n => n.id === id);
    if (!src) return;
    const state = targetStates[id];
    nodes.push({
      id: `tgt-${id}`,
      type: typeMap[id] || 'appNode',
      position: posMap[id] || { x: 0, y: 0 },
      data: { ...src, status: state.status, log: state.log } as TargetNodeData,
    });
  });

  // Add edges between provisioned nodes that are connected in source
  SOURCE_EDGES.forEach(e => {
    const srcInTarget = ids.includes(e.source);
    const tgtInTarget = ids.includes(e.target);
    if (srcInTarget && tgtInTarget) {
      const srcState = targetStates[e.source];
      const tgtState = targetStates[e.target];
      const isLive = srcState?.status === 'success' && tgtState?.status === 'success';
      edges.push({
        id: `tgt-${e.id}`,
        source: `tgt-${e.source}`,
        target: `tgt-${e.target}`,
        animated: isLive && e.type === 'channel',
        markerEnd: { type: MarkerType.ArrowClosed, color: isLive ? (e.type === 'channel' ? '#10b981' : '#14b8a6') : '#374151' },
        style: {
          stroke: isLive ? (e.type === 'channel' ? '#059669' : '#0d9488') : '#374151',
          strokeWidth: isLive && e.type === 'channel' ? 2.5 : 1.5,
          opacity: isLive ? 0.9 : 0.35,
          strokeDasharray: isLive ? undefined : '4 3',
        },
      });
    }
  });

  return { nodes, edges };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FlowDivider({ active }: { active: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 w-10 shrink-0 select-none py-4">
      <div
        className="w-px flex-1 rounded-full"
        style={{ background: active ? 'linear-gradient(180deg,rgba(14,165,233,0.05),rgba(14,165,233,0.5),rgba(14,165,233,0.05))' : 'rgba(255,255,255,0.05)' }}
      />
      <div className="flex flex-col items-center gap-1">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            animate={active ? { opacity: [0.2, 1, 0.2], x: [0, 3, 0] } : { opacity: 0.15 }}
            transition={active ? { duration: 0.9, repeat: Infinity, delay: i * 0.22 } : {}}
          >
            <ArrowRight className="w-3.5 h-3.5" style={{ color: active ? '#38BDF8' : '#1e293b' }} />
          </motion.div>
        ))}
      </div>
      <div
        className="w-px flex-1 rounded-full"
        style={{ background: active ? 'linear-gradient(180deg,rgba(14,165,233,0.05),rgba(14,165,233,0.5),rgba(14,165,233,0.05))' : 'rgba(255,255,255,0.05)' }}
      />
    </div>
  );
}

// Particle burst on drop
function ParticleBurst({ x, y, onDone }: { x: number; y: number; onDone: () => void }) {
  const particles = Array.from({ length: 12 }, (_, i) => ({ angle: (i / 12) * 360, dist: 35 + Math.random() * 25 }));
  useEffect(() => { const t = setTimeout(onDone, 800); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="fixed pointer-events-none z-50" style={{ left: x, top: y }}>
      {particles.map((p, i) => {
        const rad = (p.angle * Math.PI) / 180;
        return (
          <motion.span key={i}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(rad) * p.dist, y: Math.sin(rad) * p.dist, opacity: 0, scale: 0.3 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="absolute w-2 h-2 rounded-full"
            style={{ background: i % 3 === 0 ? '#10B981' : i % 3 === 1 ? '#38BDF8' : '#F59E0B', boxShadow: '0 0 4px currentColor' }}
          />
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  onMigrationComplete?: (nodeIds: string[]) => void;
}

export default function LiveTopologyMigrationBoard({ onMigrationComplete }: Props) {
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [isOver, setIsOver] = useState(false);
  const [migratedIds, setMigratedIds] = useState<Set<string>>(new Set());
  const [targetStates, setTargetStates] = useState<Record<string, TargetNodeState>>({});
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const particleIdRef = useRef(0);
  const esRef = useRef<EventSource | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const isDragging = dragNodeId !== null;
  const allMigrated = migratedIds.size >= SOURCE_NODES.length;
  const provisioningCount = Object.values(targetStates).filter(n => n.status === 'provisioning').length;
  const successCount = Object.values(targetStates).filter(n => n.status === 'success').length;

  // ── Drag handlers ──────────────────────────────────────────────────────────

  const handleDragStart = useCallback((nodeId: string) => {
    setDragNodeId(nodeId);
    const related = RELATED_MAP[nodeId] || [];
    setHighlightedIds(new Set([nodeId, ...related]));
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragNodeId(null);
    setHighlightedIds(new Set());
    setIsOver(false);
  }, []);

  const dragCallbacks = useMemo(() => {
    const cbs: Record<string, () => void> = {};
    SOURCE_NODES.forEach(n => { cbs[n.id] = () => handleDragStart(n.id); });
    return cbs;
  }, [handleDragStart]);

  // ── Source React Flow ──────────────────────────────────────────────────────

  const srcLayout = useMemo(
    () => buildSourceLayout(migratedIds, highlightedIds, dragCallbacks),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify([...migratedIds]), JSON.stringify([...highlightedIds])]
  );

  const [srcNodes, setSrcNodes, onSrcNodesChange] = useNodesState(srcLayout.nodes);
  const [srcEdges, setSrcEdges, onSrcEdgesChange] = useEdgesState(srcLayout.edges);

  useEffect(() => {
    const layout = buildSourceLayout(migratedIds, highlightedIds, dragCallbacks);
    setSrcNodes(layout.nodes);
    setSrcEdges(layout.edges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify([...migratedIds]), JSON.stringify([...highlightedIds])]);

  // ── Target React Flow ──────────────────────────────────────────────────────

  const tgtLayout = useMemo(
    () => buildTargetLayout(targetStates),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(targetStates)]
  );

  const [tgtNodes, setTgtNodes, onTgtNodesChange] = useNodesState(tgtLayout.nodes);
  const [tgtEdges, setTgtEdges, onTgtEdgesChange] = useEdgesState(tgtLayout.edges);

  useEffect(() => {
    const layout = buildTargetLayout(targetStates);
    setTgtNodes(layout.nodes);
    setTgtEdges(layout.edges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(targetStates)]);

  // ── Drop zone ──────────────────────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsOver(false), []);

  const simulateProvisioning = useCallback((ids: string[]) => {
    ids.forEach((id, idx) => {
      setTimeout(() => {
        setTargetStates(prev => ({
          ...prev,
          [id]: { ...prev[id], status: 'provisioning', log: [`Simulating provisioning...`] },
        }));
        setTimeout(() => {
          setTargetStates(prev => ({
            ...prev,
            [id]: { ...prev[id], status: 'success', log: [...(prev[id]?.log || []), 'Provisioned (simulated)'] },
          }));
        }, 600 + Math.random() * 500);
      }, idx * 400);
    });
  }, []);

  const handleProvisionEvent = useCallback((event: ProvisionEvent, relevantIds: string[]) => {
    if (event.type === 'node_provisioning' && event.node_id) {
      const matchId = relevantIds.find(id =>
        id === event.node_id || SOURCE_NODES.find(n => n.id === id)?.label === event.label
      );
      if (matchId) {
        setTargetStates(prev => ({
          ...prev,
          [matchId]: { ...prev[matchId], status: 'provisioning', log: [...(prev[matchId]?.log || []), `Provisioning ${event.label || matchId}...`] },
        }));
      }
    } else if (event.type === 'node_provisioned' && event.node_id) {
      const matchId = relevantIds.find(id =>
        id === event.node_id || SOURCE_NODES.find(n => n.id === id)?.label === event.label
      );
      if (matchId) {
        setTargetStates(prev => ({
          ...prev,
          [matchId]: { ...prev[matchId], status: event.status === 'success' ? 'success' : 'failed', log: [...(prev[matchId]?.log || []), `${event.status === 'success' ? 'Provisioned' : 'Failed'}: ${event.label}`] },
        }));
      }
    } else if (event.type === 'complete') {
      setTargetStates(prev => {
        const updated = { ...prev };
        relevantIds.forEach(id => {
          if (updated[id] && (updated[id].status === 'pending' || updated[id].status === 'provisioning')) {
            updated[id] = { ...updated[id], status: 'success', log: [...updated[id].log, 'Provisioned successfully'] };
          }
        });
        return updated;
      });
      onMigrationComplete?.(relevantIds);
    }
  }, [onMigrationComplete]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);
    if (!dragNodeId || migratedIds.has(dragNodeId)) return;
    const node = SOURCE_NODES.find(n => n.id === dragNodeId);
    if (!node) return;

    const related = RELATED_MAP[dragNodeId] || [];
    const toAdd = [dragNodeId, ...related].filter(id => !migratedIds.has(id));
    if (toAdd.length === 0) return;

    // Spawn particles
    const id = ++particleIdRef.current;
    setParticles(prev => [...prev, { id, x: e.clientX, y: e.clientY }]);

    setMigratedIds(prev => new Set([...prev, ...toAdd]));
    setHighlightedIds(new Set());

    const newStates: Record<string, TargetNodeState> = {};
    toAdd.forEach(nid => { newStates[nid] = { id: nid, status: 'pending', log: [] }; });
    setTargetStates(prev => ({ ...prev, ...newStates }));

    try {
      const { session_id } = await startProvisioning();
      setTargetStates(prev => {
        const updated = { ...prev };
        toAdd.forEach(nid => { if (updated[nid]) updated[nid] = { ...updated[nid], status: 'provisioning' }; });
        return updated;
      });

      esRef.current?.close();
      const es = openProvisionEventStream(session_id);
      esRef.current = es;

      es.onmessage = (evt) => {
        try { handleProvisionEvent(JSON.parse(evt.data), toAdd); } catch { /* ignore */ }
      };
      es.onerror = () => {
        setTargetStates(prev => {
          const updated = { ...prev };
          toAdd.forEach(nid => {
            if (updated[nid] && (updated[nid].status === 'pending' || updated[nid].status === 'provisioning')) {
              updated[nid] = { ...updated[nid], status: 'failed', log: [...updated[nid].log, 'Connection error - simulated mode'] };
            }
          });
          return updated;
        });
        setTimeout(() => {
          setTargetStates(prev => {
            const updated = { ...prev };
            toAdd.forEach(nid => {
              if (updated[nid] && updated[nid].status === 'failed') {
                updated[nid] = { ...updated[nid], status: 'success', log: [...updated[nid].log, 'Simulated provisioning complete'] };
              }
            });
            return updated;
          });
        }, 1500);
      };
    } catch {
      simulateProvisioning(toAdd);
    }
  }, [dragNodeId, migratedIds, handleProvisionEvent, simulateProvisioning]);

  useEffect(() => () => esRef.current?.close(), []);

  const hasTargetNodes = Object.keys(targetStates).length > 0;

  return (
    <div
      ref={boardRef}
      className="flex flex-col rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(8,12,22,0.85)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 4px 40px rgba(0,0,0,0.5)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 flex-wrap gap-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,rgba(14,165,233,0.2),rgba(2,132,199,0.1))', border: '1px solid rgba(14,165,233,0.3)' }}>
            <Zap className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white leading-tight">Live Topology Migration</h2>
            <p className="text-[10px] text-slate-500 mt-0.5">Drag nodes from source graph → target zone to provision</p>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {[
            { dot: '#64748B', label: 'Source', value: SOURCE_NODES.length },
            { dot: '#94A3B8', label: 'Queued', value: migratedIds.size - successCount - Object.values(targetStates).filter(n => n.status === 'failed').length - provisioningCount },
            { dot: '#38BDF8', label: 'Provisioning', value: provisioningCount },
            { dot: '#10B981', label: 'Success', value: successCount },
          ].map(({ dot, label, value }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />
              <span className="text-[10px] text-slate-500">{label}</span>
              <span className="text-[10px] font-mono font-semibold" style={{ color: dot }}>{Math.max(0, value)}</span>
            </div>
          ))}
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

      {/* Panel labels */}
      <div className="flex items-stretch" style={{ height: 480 }}>
        {/* Source panel */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-2 px-4 py-2"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span className="w-2 h-2 rounded-full bg-violet-400" />
            <span className="text-xs font-semibold text-slate-300">Source Topology</span>
            <span className="ml-auto text-[10px] text-slate-600 font-mono">{migratedIds.size}/{SOURCE_NODES.length} migrated</span>
            {isDragging && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[10px] text-sky-400 font-medium"
              >
                Drag to target &rarr;
              </motion.span>
            )}
          </div>
          <div className="flex-1 relative">
            <ReactFlow
              nodes={srcNodes}
              edges={srcEdges}
              onNodesChange={onSrcNodesChange}
              onEdgesChange={onSrcEdgesChange}
              nodeTypes={SOURCE_NODE_TYPES}
              fitView
              fitViewOptions={{ padding: 0.18 }}
              minZoom={0.25}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
              className="bg-transparent"
              nodesDraggable={false}
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
            <div className="absolute top-2 right-2 flex flex-col gap-1 pointer-events-none">
              {[
                { color: '#3b82f6', label: 'Producer App' },
                { color: '#10b981', label: 'Consumer App' },
                { color: '#7c3aed', label: 'Queue Manager' },
                { color: '#f59e0b', label: 'Channel' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] text-slate-400"
                  style={{ background: 'rgba(8,12,22,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Divider with animated arrows */}
        <FlowDivider active={isDragging || provisioningCount > 0} />

        {/* Target panel */}
        <div
          className="flex-1 flex flex-col min-w-0 transition-all duration-300 relative"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            outline: isOver ? '2px solid rgba(14,165,233,0.5)' : '2px solid transparent',
            outlineOffset: '-2px',
            background: isOver ? 'rgba(14,165,233,0.04)' : 'transparent',
            boxShadow: isOver ? 'inset 0 0 40px rgba(14,165,233,0.07)' : 'none',
          }}
        >
          <div className="flex items-center gap-2 px-4 py-2"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span className="w-2 h-2 rounded-full bg-teal-400" />
            <span className="text-xs font-semibold text-slate-300">Target Topology</span>
            {provisioningCount > 0 && (
              <motion.span
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="text-[10px] text-sky-400 font-medium ml-1"
              >
                Provisioning...
              </motion.span>
            )}
            {successCount > 0 && provisioningCount === 0 && (
              <span className="text-[10px] text-emerald-400 font-medium ml-1">{successCount} provisioned</span>
            )}
          </div>

          <div className="flex-1 relative">
            {hasTargetNodes ? (
              <ReactFlow
                nodes={tgtNodes}
                edges={tgtEdges}
                onNodesChange={onTgtNodesChange}
                onEdgesChange={onTgtEdgesChange}
                nodeTypes={TARGET_NODE_TYPES}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.25}
                maxZoom={2}
                proOptions={{ hideAttribution: true }}
                className="bg-transparent"
                nodesDraggable={false}
                nodesConnectable={false}
              >
                <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="rgba(100,116,139,0.1)" />
                <Controls
                  showInteractive={false}
                  className="!bg-[#0d1220]/90 !border-slate-700/50 !rounded-xl overflow-hidden !shadow-xl"
                  style={{ bottom: 8, left: 8, top: 'auto', right: 'auto' }}
                />
                <MiniMap
                  nodeColor={n => {
                    const d = n.data as TargetNodeData;
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
              <AnimatePresence>
                {isOver ? (
                  <motion.div
                    key="over"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <motion.div
                      animate={{ scale: [1, 1.06, 1] }}
                      transition={{ duration: 0.7, repeat: Infinity }}
                      className="flex flex-col items-center gap-3"
                    >
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                        style={{ background: 'rgba(14,165,233,0.15)', border: '2px solid rgba(14,165,233,0.4)', boxShadow: '0 0 28px rgba(14,165,233,0.3)' }}>
                        <Database className="w-7 h-7 text-sky-400" />
                      </div>
                      <span className="text-sm font-semibold text-sky-400">Drop to provision</span>
                    </motion.div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-4"
                  >
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '2px dashed rgba(255,255,255,0.08)' }}>
                      <PackageOpen className="w-8 h-8 text-slate-700" />
                    </div>
                    <div className="text-center space-y-1.5">
                      <p className="text-sm font-medium text-slate-500">Target Zone Empty</p>
                      <p className="text-xs text-slate-700">Drag nodes from the source graph</p>
                      <p className="text-xs text-slate-700">They will appear as a React Flow graph here</p>
                    </div>
                    <div className="flex items-center gap-2 mt-2 pointer-events-none select-none">
                      {['App', 'QM', 'Channel'].map(label => (
                        <div key={label} className="px-2 py-1 rounded-lg text-[10px] text-slate-600"
                          style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.06)' }}>
                          {label}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>

      {/* Particles */}
      {particles.map(p => (
        <ParticleBurst key={p.id} x={p.x} y={p.y} onDone={() => setParticles(prev => prev.filter(pp => pp.id !== p.id))} />
      ))}
    </div>
  );
}
