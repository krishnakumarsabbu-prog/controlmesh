import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useWorkspaceStore } from '../store/workspaceStore';
import type { LiveMetric } from '../types';

const COLOR_MAP: Record<NonNullable<LiveMetric['color']>, { text: string; glow: string }> = {
  cyan:   { text: '#22d3ee', glow: 'rgba(6,182,212,0.25)' },
  green:  { text: '#22c55e', glow: 'rgba(34,197,94,0.25)' },
  amber:  { text: '#f59e0b', glow: 'rgba(245,158,11,0.25)' },
  red:    { text: '#ef4444', glow: 'rgba(239,68,68,0.25)' },
};

function MetricCard({ metric, index }: { metric: LiveMetric; index: number }) {
  const c = COLOR_MAP[metric.color ?? 'cyan'];

  const TrendIcon =
    metric.trend === 'up' ? TrendingUp :
    metric.trend === 'down' ? TrendingDown : Minus;

  const trendColor =
    metric.trend === 'up' ? '#22c55e' :
    metric.trend === 'down' ? '#22c55e' : // latency down is good
    '#9ca3af';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="rounded-xl border p-3 flex flex-col gap-1"
      style={{
        background: 'var(--surface-card)',
        borderColor: 'var(--surface-border)',
        backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0) 100%)',
      }}
    >
      <div className="text-[10px] text-text-muted uppercase tracking-widest">{metric.label}</div>
      <div className="flex items-end gap-1.5">
        <span
          className="text-xl font-bold leading-none tabular-nums"
          style={{ color: c.text, textShadow: `0 0 12px ${c.glow}` }}
        >
          {typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value}
        </span>
        {metric.unit && (
          <span className="text-xs text-text-muted mb-0.5">{metric.unit}</span>
        )}
      </div>
      {metric.trendValue && (
        <div className="flex items-center gap-1">
          <TrendIcon className="w-3 h-3" style={{ color: trendColor }} />
          <span className="text-[11px]" style={{ color: trendColor }}>{metric.trendValue}</span>
        </div>
      )}
    </motion.div>
  );
}

export default function LiveMetricsPanel() {
  const { metrics } = useWorkspaceStore();

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="section-title">Live Metrics</span>
        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse ml-1" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {metrics.map((m, i) => (
          <MetricCard key={m.label} metric={m} index={i} />
        ))}
      </div>
    </div>
  );
}
