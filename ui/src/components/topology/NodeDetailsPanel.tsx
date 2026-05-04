import { X, Server, AppWindow, Layers, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Node } from 'reactflow';
import type { QMNodeData } from './QMNode';
import type { AppNodeData } from './AppNode';
import type { QueueNodeData } from './QueueNode';
import { STATE_COLORS } from '../../lib/colors';

type AnyNodeData = QMNodeData | AppNodeData | QueueNodeData;

interface Props {
  node: Node<AnyNodeData> | null;
  onClose: () => void;
}

function QMDetails({ data }: { data: QMNodeData }) {
  const colors = STATE_COLORS[data.migrationState];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Server className="w-4 h-4 text-slate-400 shrink-0" />
        <span className="text-sm font-semibold text-slate-200 flex-1 min-w-0 truncate">{data.label}</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
          {data.migrationState}
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs flex-wrap">
        <span className={`flex items-center gap-1 ${data.isReachable ? 'text-emerald-400' : 'text-red-400'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${data.isReachable ? 'bg-emerald-500' : 'bg-red-500'}`} />
          {data.isReachable ? 'Reachable' : 'Unreachable'}
        </span>
        <span className="text-slate-600">&bull;</span>
        <span className={`capitalize ${data.role === 'source' ? 'text-slate-400' : 'text-emerald-400'}`}>
          {data.role} QM
        </span>
        <span className="text-slate-600">&bull;</span>
        <span className="text-slate-400">{data.appCount} app{data.appCount !== 1 ? 's' : ''} bound</span>
      </div>

      {data.queues.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Queues ({data.queues.length})
          </p>
          <div className="flex flex-col gap-1 max-h-52 overflow-y-auto pr-1">
            {data.queues.map((q) => (
              <div key={q.name} className="flex items-center gap-2 py-1 px-2 rounded-md bg-slate-800/60 border border-slate-700">
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
      <div className="flex items-center gap-2 flex-wrap">
        <AppWindow className="w-4 h-4 text-blue-400 shrink-0" />
        <span className="text-sm font-semibold text-blue-200 flex-1 min-w-0 truncate">{data.label}</span>
        {data.migrationState && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300">
            {data.migrationState}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2 text-xs">
        <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-slate-800/60 border border-slate-700">
          <span className="text-slate-400 font-medium">Source QM</span>
          <span className="font-mono text-slate-200">{data.sourceQM}</span>
        </div>
        {data.targetQM && (
          <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-emerald-900/20 border border-emerald-800">
            <span className="text-emerald-400 font-medium">Target QM</span>
            <span className="font-mono text-emerald-300">{data.targetQM}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function QueueDetails({ data }: { data: QueueNodeData }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Layers className={`w-4 h-4 shrink-0 ${
          data.queueType === 'remote' ? 'text-amber-400' :
          data.queueType === 'xmit'   ? 'text-sky-400'   : 'text-slate-400'
        }`} />
        <span className="text-sm font-semibold text-slate-200 truncate flex-1 min-w-0">{data.label}</span>
        <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${
          data.queueType === 'remote' ? 'bg-amber-900/60 text-amber-400' :
          data.queueType === 'xmit'   ? 'bg-sky-900/60 text-sky-400'     : 'bg-slate-700 text-slate-400'
        }`}>{data.queueType}</span>
      </div>
      <div className="flex flex-col gap-2 text-xs">
        <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-slate-800/60 border border-slate-700">
          <span className="text-slate-400 font-medium">Owner QM</span>
          <span className="font-mono text-slate-200">{data.ownerQM}</span>
        </div>
        {data.remoteQM && (
          <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-amber-900/20 border border-amber-800">
            <span className="text-amber-400 font-medium">Routes to</span>
            <span className="font-mono text-amber-300 flex items-center gap-1">
              <ArrowRight className="w-3 h-3" />{data.remoteQM}
            </span>
          </div>
        )}
      </div>
      {data.queueType === 'remote' && (
        <p className="text-[11px] text-amber-400 bg-amber-900/20 border border-amber-800 rounded-md px-2 py-1.5">
          Remote definition — transparently routes messages to the target QM without application changes.
        </p>
      )}
      {data.queueType === 'xmit' && (
        <p className="text-[11px] text-sky-400 bg-sky-900/20 border border-sky-800 rounded-md px-2 py-1.5">
          Transmission queue — holds in-flight messages until the target QM confirms receipt.
        </p>
      )}
    </div>
  );
}

export default function NodeDetailsPanel({ node, onClose }: Props) {
  return (
    <AnimatePresence>
      {node && (
        <motion.div
          key="node-details"
          initial={{ x: 288, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 288, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          className="absolute top-0 right-0 h-full w-72 bg-[#111827]/95 border-l border-slate-700 shadow-2xl z-10 flex flex-col backdrop-blur-sm"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 shrink-0">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Node Details</span>
            <button
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {node.type === 'qmNode' && <QMDetails data={node.data as QMNodeData} />}
            {node.type === 'appNode' && <AppDetails data={node.data as AppNodeData} />}
            {node.type === 'queueNode' && <QueueDetails data={node.data as QueueNodeData} />}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
