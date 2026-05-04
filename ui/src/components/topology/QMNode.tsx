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
  highlighted?: boolean;
  dimmed?: boolean;
}

function QueueRow({ q }: { q: QueueEntry }) {
  if (q.type === 'remote') {
    return (
      <div className="flex items-center gap-1.5 text-[10px]">
        <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
        <span className="truncate font-mono text-amber-300/80">{q.name}</span>
        {q.remoteQM && (
          <span className="flex items-center gap-0.5 text-amber-400 shrink-0">
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
        <span className="w-1 h-1 rounded-sm bg-sky-400 shrink-0" />
        <span className="truncate font-mono text-sky-300/80">{q.name}</span>
        <span className="text-[9px] text-sky-400 shrink-0 font-medium">XMIT</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
      <span className="w-1 h-1 rounded-full bg-slate-500 shrink-0" />
      <span className="truncate font-mono">{q.name}</span>
    </div>
  );
}

export const QMNode = memo(({ data, selected }: NodeProps<QMNodeData>) => {
  const colors = STATE_COLORS[data.migrationState];
  const isPulsing = PULSING_STATES.includes(data.migrationState);
  const isMigrated = data.migrationState === 'MIGRATED';
  const isRewiring = data.migrationState === 'REWIRING';
  const isHighlighted = selected || data.highlighted;

  const remoteCount = data.queues.filter((q) => q.type === 'remote').length;
  const xmitCount = data.queues.filter((q) => q.type === 'xmit').length;
  const visibleQueues = data.queues.slice(0, 5);

  const borderColor = isHighlighted
    ? '#a78bfa'
    : isMigrated
    ? '#34d399'
    : isRewiring
    ? '#fbbf24'
    : '#7c3aed60';

  return (
    <div
      className={`
        relative min-w-[210px] rounded-xl border-2 shadow-xl
        transition-all duration-300
        ${data.dimmed ? 'opacity-25' : 'opacity-100'}
        bg-[#1a0f2e]
      `}
      style={{
        borderColor,
        boxShadow: isHighlighted
          ? '0 0 24px 4px rgba(167,139,250,0.5), 0 4px 16px rgba(0,0,0,0.7)'
          : isMigrated
          ? '0 0 14px 2px rgba(52,211,153,0.3), 0 4px 12px rgba(0,0,0,0.6)'
          : '0 4px 16px rgba(0,0,0,0.6)',
      }}
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
      <div className={`flex items-center gap-2 px-3 py-2.5 rounded-t-xl ${
        data.role === 'source' ? 'bg-violet-900/50' : 'bg-purple-900/50'
      }`}>
        <Server className="w-4 h-4 shrink-0 text-violet-300" />
        <span className="text-xs font-bold text-violet-100 truncate flex-1 tracking-wide">
          {data.label}
        </span>
        {data.isReachable
          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
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
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-900/30 border border-amber-700/40">
            <span className="text-[10px] text-amber-400 font-medium">
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
            <div className="text-[10px] text-slate-500 pl-2.5">
              +{data.queues.length - 5} more
            </div>
          )}
        </div>

        <div className="text-[10px] text-violet-400/70">
          {data.appCount} app{data.appCount !== 1 ? 's' : ''} bound
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="!bg-violet-500 !w-3 !h-3 !border-2 !border-violet-300"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-violet-500 !w-3 !h-3 !border-2 !border-violet-300"
      />
    </div>
  );
});

QMNode.displayName = 'QMNode';
