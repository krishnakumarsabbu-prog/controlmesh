import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { AppWindow } from 'lucide-react';

export interface AppNodeData {
  label: string;
  sourceQM: string;
  targetQM?: string;
  migrationState?: string;
  highlighted?: boolean;
  dimmed?: boolean;
}

export const AppNode = memo(({ data, selected }: NodeProps<AppNodeData>) => {
  return (
    <div
      className={`
        relative min-w-[130px] rounded-xl border-2 shadow-lg
        transition-all duration-200
        ${data.dimmed ? 'opacity-25' : 'opacity-100'}
        ${selected || data.highlighted
          ? 'border-blue-400 shadow-blue-500/40 bg-blue-950/90'
          : 'border-blue-700/70 bg-blue-950/70'}
      `}
      style={{
        boxShadow: selected || data.highlighted
          ? '0 0 18px 3px rgba(59,130,246,0.45), 0 2px 8px rgba(0,0,0,0.6)'
          : undefined,
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-900/50 rounded-t-xl">
        <AppWindow className="w-3.5 h-3.5 shrink-0 text-blue-300" />
        <span className="text-xs font-bold text-blue-100 truncate tracking-wide">{data.label}</span>
      </div>
      <div className="px-3 py-2">
        <div className="text-[10px] text-blue-400/80 font-mono truncate">{data.sourceQM}</div>
        {data.targetQM && (
          <div className="text-[10px] text-emerald-400 font-mono truncate mt-0.5">&rarr; {data.targetQM}</div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-blue-500 !w-2.5 !h-2.5 !border-2 !border-blue-300"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-blue-500 !w-2.5 !h-2.5 !border-2 !border-blue-300"
      />
    </div>
  );
});

AppNode.displayName = 'AppNode';
