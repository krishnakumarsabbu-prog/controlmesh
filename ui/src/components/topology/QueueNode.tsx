import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Layers } from 'lucide-react';

export interface QueueNodeData {
  label: string;
  queueType: 'local' | 'remote' | 'xmit';
  ownerQM: string;
  remoteQM?: string;
}

const TYPE_STYLES: Record<QueueNodeData['queueType'], {
  border: string; bg: string; headerBg: string; dot: string; text: string; badge: string;
}> = {
  local:  { border: 'border-slate-700', bg: 'bg-slate-900/60', headerBg: 'bg-slate-800/60', dot: 'bg-slate-400',  text: 'text-slate-300', badge: 'bg-slate-700 text-slate-400' },
  remote: { border: 'border-amber-800', bg: 'bg-amber-950/40', headerBg: 'bg-amber-900/40', dot: 'bg-amber-400',  text: 'text-amber-300', badge: 'bg-amber-900/60 text-amber-400' },
  xmit:   { border: 'border-sky-800',   bg: 'bg-sky-950/40',   headerBg: 'bg-sky-900/40',   dot: 'bg-sky-400',    text: 'text-sky-300',   badge: 'bg-sky-900/60 text-sky-400' },
};

export const QueueNode = memo(({ data, selected }: NodeProps<QueueNodeData>) => {
  const s = TYPE_STYLES[data.queueType];

  return (
    <div
      className={`
        relative min-w-[140px] rounded-lg border-2 ${s.bg} shadow-md
        transition-all duration-200
        ${selected ? 'border-slate-400 shadow-slate-700/40' : s.border}
      `}
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
      <Handle type="target" position={Position.Left} className="!bg-slate-500 !w-2 !h-2 !border-slate-400" />
      <Handle type="source" position={Position.Right} className="!bg-slate-500 !w-2 !h-2 !border-slate-400" />
    </div>
  );
});

QueueNode.displayName = 'QueueNode';
