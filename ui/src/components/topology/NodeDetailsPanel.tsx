import { X, Server, AppWindow, Layers, ArrowRight, Link2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Node, Edge } from 'reactflow';
import type { QMNodeData } from './QMNode';
import type { AppNodeData } from './AppNode';
import type { QueueNodeData } from './QueueNode';
import { STATE_COLORS } from '../../lib/colors';

type AnyNodeData = QMNodeData | AppNodeData | QueueNodeData;

interface Props {
  node: Node<AnyNodeData> | null;
  edges: Edge[];
  nodes: Node[];
  onClose: () => void;
}

function ConnectionsList({
  nodeId,
  edges,
  nodes,
}: {
  nodeId: string;
  edges: Edge[];
  nodes: Node[];
}) {
  const connected = edges
    .filter((e) => e.source === nodeId || e.target === nodeId)
    .map((e) => {
      const connectedId = e.source === nodeId ? e.target : e.source;
      const direction = e.source === nodeId ? 'out' : 'in';
      const connNode = nodes.find((n) => n.id === connectedId);
      return { id: connectedId, direction, type: connNode?.type ?? 'unknown', label: connNode?.data?.label ?? connectedId };
    });

  if (connected.length === 0) {
    return <p className="text-[11px] text-slate-500 italic">No direct connections</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      {connected.map((c, i) => (
        <div
          key={i}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60"
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${
            c.type === 'appNode' ? 'bg-blue-400' :
            c.type === 'qmNode'  ? 'bg-violet-400' : 'bg-slate-400'
          }`} />
          <span className="text-[11px] font-mono text-slate-300 flex-1 truncate">{c.label}</span>
          <span className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded shrink-0 ${
            c.direction === 'out'
              ? 'bg-blue-900/60 text-blue-400'
              : 'bg-slate-700/80 text-slate-400'
          }`}>
            {c.direction === 'out' ? '→ out' : '← in'}
          </span>
        </div>
      ))}
    </div>
  );
}

function NodeTypeBadge({ type }: { type: string }) {
  const cfg = type === 'appNode'
    ? { label: 'Application', bg: 'bg-blue-900/50', text: 'text-blue-300', dot: 'bg-blue-400' }
    : type === 'qmNode'
    ? { label: 'Queue Manager', bg: 'bg-violet-900/50', text: 'text-violet-300', dot: 'bg-violet-400' }
    : { label: 'Queue', bg: 'bg-slate-800/60', text: 'text-slate-300', dot: 'bg-slate-400' };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function QMDetails({ data }: { data: QMNodeData }) {
  const colors = STATE_COLORS[data.migrationState];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 flex-wrap">
        <Server className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-100 truncate">{data.label}</p>
          <NodeTypeBadge type="qmNode" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="px-2 py-2 rounded-lg bg-slate-800/60 border border-slate-700/60">
          <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider mb-1">Status</p>
          <p className={`text-xs font-semibold ${data.isReachable ? 'text-emerald-400' : 'text-red-400'}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${data.isReachable ? 'bg-emerald-500' : 'bg-red-500'}`} />
            {data.isReachable ? 'Reachable' : 'Unreachable'}
          </p>
        </div>
        <div className="px-2 py-2 rounded-lg bg-slate-800/60 border border-slate-700/60">
          <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider mb-1">Role</p>
          <p className={`text-xs font-semibold capitalize ${data.role === 'source' ? 'text-slate-300' : 'text-emerald-400'}`}>
            {data.role}
          </p>
        </div>
      </div>

      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium ${colors.bg} ${colors.text} self-start`}>
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: colors.dot }} />
        {data.migrationState}
      </div>

      {data.queues.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Queues ({data.queues.length})
          </p>
          <div className="flex flex-col gap-1 max-h-40 overflow-y-auto pr-1">
            {data.queues.map((q) => (
              <div key={q.name} className="flex items-center gap-2 py-1 px-2 rounded-md bg-slate-800/60 border border-slate-700/60">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  q.type === 'remote' ? 'bg-amber-400' :
                  q.type === 'xmit'   ? 'bg-sky-400'   : 'bg-slate-400'
                }`} />
                <span className="text-[11px] font-mono text-slate-300 truncate flex-1">{q.name}</span>
                <span className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded shrink-0 ${
                  q.type === 'remote' ? 'bg-amber-900/60 text-amber-400' :
                  q.type === 'xmit'   ? 'bg-sky-900/60 text-sky-400'     : 'bg-slate-700 text-slate-400'
                }`}>{q.type}</span>
                {q.remoteQM && (
                  <span className="flex items-center gap-0.5 text-amber-400 text-[10px] font-mono shrink-0">
                    <ArrowRight className="w-2.5 h-2.5" />{q.remoteQM}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AppDetails({ data }: { data: AppNodeData }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 flex-wrap">
        <AppWindow className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-blue-100 truncate">{data.label}</p>
          <NodeTypeBadge type="appNode" />
        </div>
      </div>
      {data.migrationState && (
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300 self-start">
          {data.migrationState}
        </span>
      )}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
          <span className="text-[11px] text-slate-400 font-medium">Source QM</span>
          <span className="text-[11px] font-mono text-slate-200">{data.sourceQM}</span>
        </div>
        {data.targetQM && (
          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-emerald-900/20 border border-emerald-800/40">
            <span className="text-[11px] text-emerald-400 font-medium">Target QM</span>
            <span className="text-[11px] font-mono text-emerald-300">{data.targetQM}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function QueueDetails({ data }: { data: QueueNodeData }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 flex-wrap">
        <Layers className={`w-4 h-4 shrink-0 mt-0.5 ${
          data.queueType === 'remote' ? 'text-amber-400' :
          data.queueType === 'xmit'   ? 'text-sky-400'   : 'text-slate-400'
        }`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-100 truncate">{data.label}</p>
          <NodeTypeBadge type="queueNode" />
        </div>
      </div>
      <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full self-start ${
        data.queueType === 'remote' ? 'bg-amber-900/60 text-amber-400' :
        data.queueType === 'xmit'   ? 'bg-sky-900/60 text-sky-400'     : 'bg-slate-700 text-slate-400'
      }`}>{data.queueType}</span>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
          <span className="text-[11px] text-slate-400 font-medium">Owner QM</span>
          <span className="text-[11px] font-mono text-slate-200">{data.ownerQM}</span>
        </div>
        {data.remoteQM && (
          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-amber-900/20 border border-amber-800/40">
            <span className="text-[11px] text-amber-400 font-medium">Routes to</span>
            <span className="text-[11px] font-mono text-amber-300 flex items-center gap-1">
              <ArrowRight className="w-3 h-3" />{data.remoteQM}
            </span>
          </div>
        )}
      </div>
      {data.queueType === 'remote' && (
        <p className="text-[11px] text-amber-400/80 bg-amber-900/20 border border-amber-800/30 rounded-lg px-3 py-2">
          Remote definition — routes messages to the target QM transparently.
        </p>
      )}
      {data.queueType === 'xmit' && (
        <p className="text-[11px] text-sky-400/80 bg-sky-900/20 border border-sky-800/30 rounded-lg px-3 py-2">
          Transmission queue — holds in-flight messages until the target QM confirms receipt.
        </p>
      )}
    </div>
  );
}

export default function NodeDetailsPanel({ node, edges, nodes, onClose }: Props) {
  return (
    <AnimatePresence>
      {node && (
        <motion.div
          key="node-details"
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 300, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="absolute top-0 right-0 h-full w-72 flex flex-col z-20"
          style={{
            background: 'linear-gradient(160deg, rgba(15,17,30,0.97) 0%, rgba(10,10,20,0.98) 100%)',
            borderLeft: '1px solid rgba(100,116,139,0.3)',
            backdropFilter: 'blur(12px)',
            boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ borderBottom: '1px solid rgba(100,116,139,0.2)' }}
          >
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Node Details</span>
            <button
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-700/60 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
            {node.type === 'qmNode' && <QMDetails data={node.data as QMNodeData} />}
            {node.type === 'appNode' && <AppDetails data={node.data as AppNodeData} />}
            {node.type === 'queueNode' && <QueueDetails data={node.data as QueueNodeData} />}

            {/* Connections section */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Link2 className="w-3 h-3 text-slate-500" />
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                  Connections
                </p>
              </div>
              <ConnectionsList nodeId={node.id} edges={edges} nodes={nodes} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
