import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Layers } from 'lucide-react';

export interface QueueNodeData {
  label: string;
  queueType: 'local' | 'remote' | 'xmit';
  ownerQM: string;
  remoteQM?: string;
  highlighted?: boolean;
  dimmed?: boolean;
}

const TYPE_STYLES: Record<QueueNodeData['queueType'], {
  border: string; bg: string; headerBg: string; dot: string; text: string; badge: string; glow: string;
}> = {
  local:  {
    border: 'border-slate-600/60',
    bg: 'bg-slate-900/80',
    headerBg: 'bg-slate-800/70',
    dot: 'bg-slate-400',
    text: 'text-slate-300',
    badge: 'bg-slate-700/80 text-slate-400',
    glow: 'rgba(148,163,184,0.3)',
  },
  remote: {
    border: 'border-amber-700/60',
    bg: 'bg-amber-950/50',
    headerBg: 'bg-amber-900/40',
    dot: 'bg-amber-400',
    text: 'text-amber-300',
    badge: 'bg-amber-900/60 text-amber-400',
    glow: 'rgba(251,191,36,0.3)',
  },
  xmit: {
    border: 'border-sky-700/60',
    bg: 'bg-sky-950/50',
    headerBg: 'bg-sky-900/40',
    dot: 'bg-sky-400',
    text: 'text-sky-300',
    badge: 'bg-sky-900/60 text-sky-400',
    glow: 'rgba(56,189,248,0.3)',
  },
};

export const QueueNode = memo(({ data, selected }: NodeProps<QueueNodeData>) => {
  const s = TYPE_STYLES[data.queueType];
  const isHighlighted = selected || data.highlighted;

  return (
    <div
      className={`
        relative min-w-[120px] rounded-lg border-2 shadow-md
        transition-all duration-200
        ${data.dimmed ? 'opacity-20' : 'opacity-100'}
        ${s.bg}
        ${isHighlighted ? 'border-slate-400' : s.border}
      `}
      style={{
        boxShadow: isHighlighted
          ? `0 0 14px 2px ${s.glow}, 0 2px 8px rgba(0,0,0,0.6)`
          : '0 2px 8px rgba(0,0,0,0.5)',
      }}
    >
      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-t-lg ${s.headerBg}`}>
        <Layers className={`w-3 h-3 shrink-0 ${s.text}`} />
        <span className={`text-[11px] font-semibold truncate ${s.text}`}>{data.label}</span>
      </div>
      <div className="px-2.5 py-1.5 flex items-center gap-1.5 flex-wrap">
        <span className={`w-1.5 h-1.5 rounded-full ${s.dot} shrink-0`} />
        <span className={`text-[10px] font-medium uppercase tracking-wide px-1 py-0.5 rounded ${s.badge}`}>
          {data.queueType}
        </span>
        {data.remoteQM && (
          <span className="text-[10px] font-mono text-amber-400 truncate">&rarr; {data.remoteQM}</span>
        )}
      </div>
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-slate-500 !w-2 !h-2 !border-slate-400"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-slate-500 !w-2 !h-2 !border-slate-400"
      />
    </div>
  );
});

QueueNode.displayName = 'QueueNode';
