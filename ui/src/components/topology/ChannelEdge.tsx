import { memo, useEffect, useRef } from 'react';
import { type EdgeProps, getBezierPath, EdgeLabelRenderer, BaseEdge } from 'reactflow';

export interface ChannelEdgeData {
  label: string;
  isRewiring: boolean;
  highlighted?: boolean;
  dimmed?: boolean;
}

// Animated particle dot that travels along an SVG path
function FlowParticle({
  pathId,
  color,
  delay,
  duration,
}: {
  pathId: string;
  color: string;
  delay: number;
  duration: number;
}) {
  return (
    <circle r="3" fill={color} opacity="0.9">
      <animateMotion
        dur={`${duration}s`}
        begin={`${delay}s`}
        repeatCount="indefinite"
        rotate="auto"
      >
        <mpath href={`#${pathId}`} />
      </animateMotion>
    </circle>
  );
}

export const ChannelEdge = memo(({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data, markerEnd,
}: EdgeProps<ChannelEdgeData>) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const isActive = data?.isRewiring ?? false;
  const isHighlighted = data?.highlighted ?? false;
  const isDimmed = data?.dimmed ?? false;

  const strokeColor = isHighlighted
    ? '#e2e8f0'
    : isActive
    ? '#f59e0b'
    : '#475569';

  const particleColor = isActive ? '#fde68a' : '#93c5fd';
  const pathId = `path-${id}`;

  return (
    <>
      {/* Hidden path for particle motion */}
      <defs>
        <path id={pathId} d={edgePath} />
        <marker
          id={`arrow-${id}`}
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L8,3 z" fill={strokeColor} opacity={isDimmed ? 0.2 : 0.9} />
        </marker>
      </defs>

      {/* Glow halo for highlighted/rewiring */}
      {(isHighlighted || isActive) && !isDimmed && (
        <path
          d={edgePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth={8}
          opacity={0.12}
          strokeLinecap="round"
        />
      )}

      {/* Main edge path */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={isHighlighted ? 2.5 : isActive ? 2 : 1.5}
        strokeDasharray={isActive ? '8 5' : undefined}
        strokeLinecap="round"
        opacity={isDimmed ? 0.1 : 1}
        markerEnd={`url(#arrow-${id})`}
        style={isActive ? { animation: 'dash-move 0.8s linear infinite' } : undefined}
      />

      {/* Flowing particles */}
      {!isDimmed && (
        <g>
          <FlowParticle pathId={pathId} color={particleColor} delay={0} duration={2.2} />
          <FlowParticle pathId={pathId} color={particleColor} delay={0.8} duration={2.2} />
          {isActive && (
            <FlowParticle pathId={pathId} color={particleColor} delay={1.6} duration={2.2} />
          )}
        </g>
      )}

      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
            }}
            className={`
              nodrag nopan px-1.5 py-0.5 rounded text-[10px] font-mono select-none
              ${isDimmed ? 'opacity-10' : ''}
              ${isActive
                ? 'bg-amber-950/90 text-amber-300 border border-amber-700'
                : 'bg-slate-900/90 text-slate-400 border border-slate-700'
              }
            `}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

ChannelEdge.displayName = 'ChannelEdge';
