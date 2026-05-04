import { memo } from 'react';
import { type EdgeProps, getBezierPath, EdgeLabelRenderer } from 'reactflow';

export interface ChannelEdgeData {
  label: string;
  isRewiring: boolean;
}

export const ChannelEdge = memo(({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data,
}: EdgeProps<ChannelEdgeData>) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const isActive = data?.isRewiring ?? false;
  const color = isActive ? '#f59e0b' : '#94a3b8';

  return (
    <>
      <defs>
        <marker
          id={`arrow-${id}`}
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L8,3 z" fill={color} />
        </marker>
      </defs>

      {isActive && (
        <path
          d={edgePath}
          fill="none"
          stroke={color}
          strokeWidth={7}
          opacity={0.15}
          strokeLinecap="round"
        />
      )}

      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={isActive ? 2.5 : 1.5}
        strokeDasharray={isActive ? '8 4' : undefined}
        strokeLinecap="round"
        markerEnd={`url(#arrow-${id})`}
        style={isActive ? { animation: 'dash-move 0.8s linear infinite' } : undefined}
      />

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'none',
          }}
          className={`
            nodrag nopan px-1.5 py-0.5 rounded text-[10px] font-mono select-none
            ${isActive
              ? 'bg-amber-100 text-amber-700 border border-amber-200'
              : 'bg-white text-slate-400 border border-slate-100'
            }
          `}
        >
          {data?.label}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

ChannelEdge.displayName = 'ChannelEdge';
