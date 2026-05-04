import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { motion, AnimatePresence } from 'framer-motion';
import { Server, CircleAlert as AlertCircle, CircleCheck as CheckCircle2, ArrowRight } from 'lucide-react';
import { STATE_COLORS, PULSING_STATES } from '../../lib/colors';
import type { MigrationState } from '../../types';

export interface QueueEntry {
  name: string;
  type: 'local' | 'remote' | 'xmit';
  remoteQM?: string;
}

export interface QMNodeData {
  label: string;
  role: 'source' | 'target';
  migrationState: MigrationState;
  appCount: number;
  queues: QueueEntry[];
  isReachable: boolean;
}

function QueueRow({ q }: { q: QueueEntry }) {
  if (q.type === 'remote') {
    return (
      <div className="flex items-center gap-1.5 text-[10px]">
        <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
        <span className="truncate font-mono text-amber-700">{q.name}</span>
        {q.remoteQM && (
          <span className="flex items-center gap-0.5 text-amber-500 shrink-0">
            <ArrowRight className="w-2.5 h-2.5" />
            <span className="font-mono text-[9px]">{q.remoteQM}</span>
          </span>
        )}
      </div>
    );
  }

  if (q.type === 'xmit') {
    return (
      <div className="flex items-center gap-1.5 text-[10px]">
        <span className="w-1 h-1 rounded-sm bg-blue-300 shrink-0" />
        <span className="truncate font-mono text-blue-500">{q.name}</span>
        <span className="text-[9px] text-blue-400 shrink-0 font-medium">XMIT</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
      <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
      <span className="truncate font-mono">{q.name}</span>
    </div>
  );
}

export const QMNode = memo(({ data, selected }: NodeProps<QMNodeData>) => {
  const colors = STATE_COLORS[data.migrationState];
  const isPulsing = PULSING_STATES.includes(data.migrationState);
  const isMigrated = data.migrationState === 'MIGRATED';
  const isRewiring = data.migrationState === 'REWIRING';

  const remoteCount = data.queues.filter((q) => q.type === 'remote').length;
  const xmitCount = data.queues.filter((q) => q.type === 'xmit').length;
  const visibleQueues = data.queues.slice(0, 5);

  return (
    <div
      className={`
        relative min-w-[200px] rounded-xl border-2 bg-white shadow-md
        transition-all duration-300
        ${selected ? 'shadow-lg shadow-blue-100 border-blue-400' : ''}
        ${!selected && isMigrated ? 'border-emerald-400' : ''}
        ${!selected && isRewiring ? 'border-amber-400' : ''}
        ${!selected && !isMigrated && !isRewiring ? 'border-slate-200' : ''}
      `}
    >
      {/* Pulse ring */}
      <AnimatePresence>
        {isPulsing && (
          <motion.div
            className="absolute inset-[-4px] rounded-xl pointer-events-none"
            initial={{ opacity: 0.7, scale: 1 }}
            animate={{ opacity: 0, scale: 1.1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
            style={{ border: `2px solid ${colors.dot}` }}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-t-xl ${
        data.role === 'source' ? 'bg-slate-100' : 'bg-emerald-50'
      }`}>
        <Server className={`w-4 h-4 shrink-0 ${
          data.role === 'source' ? 'text-slate-500' : 'text-emerald-600'
        }`} />
        <span className="text-xs font-semibold text-slate-700 truncate flex-1">
          {data.label}
        </span>
        {data.isReachable
          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          : <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
        }
      </div>

      {/* Body */}
      <div className="px-3 py-2.5 space-y-2">
        {/* State badge */}
        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${colors.bg} ${colors.text}`}>
          <motion.span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: colors.dot }}
            animate={isPulsing ? { opacity: [1, 0.2, 1] } : { opacity: 1 }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          {data.migrationState}
        </div>

        {/* Rewiring indicator */}
        {(remoteCount > 0 || xmitCount > 0) && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-50 border border-amber-100">
            <span className="text-[10px] text-amber-700 font-medium">
              {remoteCount > 0 && `${remoteCount} remote def${remoteCount > 1 ? 's' : ''}`}
              {remoteCount > 0 && xmitCount > 0 && ' · '}
              {xmitCount > 0 && `${xmitCount} xmit`}
            </span>
          </div>
        )}

        {/* Queues */}
        <div className="space-y-0.5">
          {visibleQueues.map((q) => (
            <QueueRow key={q.name} q={q} />
          ))}
          {data.queues.length > 5 && (
            <div className="text-[10px] text-slate-400 pl-2.5">
              +{data.queues.length - 5} more
            </div>
          )}
        </div>

        <div className="text-[10px] text-slate-400">
          {data.appCount} app{data.appCount !== 1 ? 's' : ''} bound
        </div>
      </div>

      <Handle type="target" position={Position.Left} className="!bg-slate-300 !w-2 !h-2 !border-slate-400" />
      <Handle type="source" position={Position.Right} className="!bg-slate-300 !w-2 !h-2 !border-slate-400" />
    </div>
  );
});

QMNode.displayName = 'QMNode';
