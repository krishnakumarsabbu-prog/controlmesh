import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { AppWindow } from 'lucide-react';

export interface AppNodeData {
  label: string;
  sourceQM: string;
  targetQM?: string;
  migrationState?: string;
}

export const AppNode = memo(({ data, selected }: NodeProps<AppNodeData>) => {
  return (
    <div
      className={`
        relative min-w-[140px] rounded-lg border-2 shadow-md
        transition-all duration-200
        ${selected
          ? 'border-blue-400 shadow-blue-900/40 bg-blue-950/60'
          : 'border-blue-800 bg-blue-950/40'}
      `}
    >
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-900/40 rounded-t-lg">
        <AppWindow className="w-3.5 h-3.5 shrink-0 text-blue-400" />
        <span className="text-xs font-semibold text-blue-200 truncate">{data.label}</span>
      </div>
      <div className="px-3 py-1.5">
        <div className="text-[10px] text-blue-400 font-mono truncate">{data.sourceQM}</div>
        {data.targetQM && (
          <div className="text-[10px] text-emerald-400 font-mono truncate">&rarr; {data.targetQM}</div>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-blue-500 !w-2 !h-2 !border-blue-400" />
      <Handle type="target" position={Position.Left} className="!bg-blue-500 !w-2 !h-2 !border-blue-400" />
    </div>
  );
});

AppNode.displayName = 'AppNode';
