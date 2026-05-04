import { useEffect, useRef, useState } from 'react';
import { Server, AppWindow, GitBranch, ArrowUpRight, ArrowDownRight, Minus, CircleCheck as CheckCircle2, Play, ShieldCheck, CircleAlert as AlertCircle, RefreshCw } from 'lucide-react';

// ─── Animated counter ────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(ease * target));
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return value;
}

// ─── Types ───────────────────────────────────────────────────────────────────

type Trend = 'up' | 'down' | 'neutral';

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  trend: Trend;
  trendLabel: string;
  accentColor: string;
  glowColor: string;
  delay?: number;
}

interface TimelineEntry {
  id: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  detail: string;
  timestamp: string;
  status: 'success' | 'info' | 'warning' | 'running';
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

function MetricCard({ icon: Icon, label, value, trend, trendLabel, accentColor, glowColor, delay = 0 }: MetricCardProps) {
  const count = useCountUp(value, 1000 + delay);
  const [hovered, setHovered] = useState(false);

  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus;
  const trendColor = trend === 'up' ? '#22C55E' : trend === 'down' ? '#EF4444' : '#6B7280';

  return (
    <div
      className="relative flex-1 min-w-0 rounded-2xl p-5 cursor-default select-none transition-all duration-300"
      style={{
        background: 'linear-gradient(135deg, rgba(20,27,45,0.95) 0%, rgba(15,21,35,0.98) 100%)',
        border: hovered
          ? `1px solid ${accentColor}55`
          : '1px solid rgba(30,42,61,0.9)',
        boxShadow: hovered
          ? `0 0 0 1px ${accentColor}22, 0 8px 32px rgba(0,0,0,0.4), 0 0 24px ${glowColor}`
          : '0 2px 16px rgba(0,0,0,0.3)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Background glow dot */}
      <div
        className="absolute top-3 right-3 w-16 h-16 rounded-full pointer-events-none transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
          opacity: hovered ? 0.35 : 0.15,
        }}
      />

      {/* Icon */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center mb-4"
        style={{
          background: `linear-gradient(135deg, ${accentColor}22 0%, ${accentColor}0a 100%)`,
          border: `1px solid ${accentColor}33`,
        }}
      >
        <Icon className="w-4 h-4" style={{ color: accentColor }} strokeWidth={1.5} />
      </div>

      {/* Value */}
      <div
        className="text-4xl font-bold tracking-tight leading-none mb-1.5 tabular-nums"
        style={{ color: '#E5E7EB' }}
      >
        {count}
      </div>

      {/* Label */}
      <div className="text-sm font-medium text-text-secondary mb-3">{label}</div>

      {/* Trend */}
      <div className="flex items-center gap-1.5">
        <div
          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-semibold"
          style={{
            background: `${trendColor}15`,
            color: trendColor,
          }}
        >
          <TrendIcon className="w-3 h-3" />
          {trendLabel}
        </div>
        <span className="text-[11px] text-text-muted">vs last hour</span>
      </div>

      {/* Bottom accent bar */}
      <div
        className="absolute bottom-0 left-6 right-6 h-px rounded-full transition-opacity duration-300"
        style={{
          background: `linear-gradient(90deg, transparent, ${accentColor}66, transparent)`,
          opacity: hovered ? 1 : 0.4,
        }}
      />
    </div>
  );
}

// ─── Timeline row ─────────────────────────────────────────────────────────────

function TimelineRow({ entry, isLast }: { entry: TimelineEntry; isLast: boolean }) {
  const [hovered, setHovered] = useState(false);

  const statusStyles: Record<TimelineEntry['status'], { dot: string; pulse: string }> = {
    success: { dot: '#22C55E', pulse: 'rgba(34,197,94,0.25)' },
    info:    { dot: '#06B6D4', pulse: 'rgba(6,182,212,0.25)' },
    warning: { dot: '#F59E0B', pulse: 'rgba(245,158,11,0.25)' },
    running: { dot: '#6366F1', pulse: 'rgba(99,102,241,0.3)' },
  };

  const s = statusStyles[entry.status];

  return (
    <div
      className="group relative flex items-start gap-4 py-3.5 px-4 rounded-xl transition-all duration-200 cursor-default"
      style={{
        background: hovered ? 'rgba(255,255,255,0.025)' : 'transparent',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Vertical connector */}
      {!isLast && (
        <div
          className="absolute left-[27px] top-[52px] w-px"
          style={{
            height: 'calc(100% - 16px)',
            background: 'linear-gradient(180deg, rgba(30,42,61,0.9) 0%, rgba(30,42,61,0.3) 100%)',
          }}
        />
      )}

      {/* Icon circle */}
      <div
        className="relative shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5"
        style={{
          background: entry.iconBg,
          border: `1px solid ${entry.iconColor}33`,
          boxShadow: hovered ? `0 0 12px ${entry.iconColor}44` : 'none',
          transition: 'box-shadow 0.2s',
        }}
      >
        <entry.icon className="w-3.5 h-3.5" style={{ color: entry.iconColor }} strokeWidth={2} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-text-primary">{entry.title}</span>
          <span className="text-[11px] text-text-muted font-mono shrink-0">{entry.timestamp}</span>
        </div>
        <div className="text-xs text-text-secondary mt-0.5">{entry.detail}</div>
      </div>

      {/* Status dot */}
      <div className="shrink-0 mt-1.5 relative flex items-center justify-center w-4 h-4">
        {entry.status === 'running' && (
          <div
            className="absolute w-4 h-4 rounded-full animate-ping"
            style={{ background: s.pulse }}
          />
        )}
        <div
          className="w-2 h-2 rounded-full relative z-10"
          style={{ background: s.dot, boxShadow: `0 0 6px ${s.dot}` }}
        />
      </div>
    </div>
  );
}

// ─── DashboardPage ────────────────────────────────────────────────────────────

const METRICS: MetricCardProps[] = [
  {
    icon: Server,
    label: 'Queue Managers',
    value: 2,
    trend: 'neutral',
    trendLabel: 'No change',
    accentColor: '#6366F1',
    glowColor: 'rgba(99,102,241,0.3)',
    delay: 0,
  },
  {
    icon: AppWindow,
    label: 'Applications',
    value: 6,
    trend: 'up',
    trendLabel: '+2',
    accentColor: '#06B6D4',
    glowColor: 'rgba(6,182,212,0.3)',
    delay: 100,
  },
  {
    icon: GitBranch,
    label: 'Active Flows',
    value: 8,
    trend: 'up',
    trendLabel: '+3',
    accentColor: '#22C55E',
    glowColor: 'rgba(34,197,94,0.3)',
    delay: 200,
  },
];

const TIMELINE: TimelineEntry[] = [
  {
    id: '1',
    icon: Play,
    iconColor: '#6366F1',
    iconBg: 'rgba(99,102,241,0.12)',
    title: 'Migration started',
    detail: 'APP-001 → QM-SRC-A to QM-TGT-B · Operator: admin@controlmesh.io',
    timestamp: '14:32:01',
    status: 'running',
  },
  {
    id: '2',
    icon: CheckCircle2,
    iconColor: '#22C55E',
    iconBg: 'rgba(34,197,94,0.10)',
    title: 'Step 1 completed',
    detail: 'Snapshot captured · 412 messages preserved · 0 errors',
    timestamp: '14:32:18',
    status: 'success',
  },
  {
    id: '3',
    icon: ShieldCheck,
    iconColor: '#06B6D4',
    iconBg: 'rgba(6,182,212,0.10)',
    title: 'Validation passed',
    detail: 'Policy checks: naming, TLS, DLQ, MCA — all passed',
    timestamp: '14:32:45',
    status: 'success',
  },
  {
    id: '4',
    icon: RefreshCw,
    iconColor: '#F59E0B',
    iconBg: 'rgba(245,158,11,0.10)',
    title: 'Cutover in progress',
    detail: 'Traffic shifting to target queue manager · Draining source',
    timestamp: '14:33:02',
    status: 'running',
  },
  {
    id: '5',
    icon: AlertCircle,
    iconColor: '#6B7280',
    iconBg: 'rgba(107,114,128,0.10)',
    title: 'Awaiting confirmation',
    detail: 'Post-migration health check scheduled',
    timestamp: '14:33:10',
    status: 'info',
  },
];

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div
      className="space-y-6"
      style={{
        opacity: mounted ? 1 : 0,
        transition: 'opacity 0.4s ease',
      }}
    >
      {/* Page heading */}
      <div>
        <h1 className="text-xl font-bold text-text-primary tracking-tight">Overview</h1>
        <p className="text-sm text-text-muted mt-0.5">Real-time health and activity across the ControlMesh fleet</p>
      </div>

      {/* Metric cards row */}
      <div className="flex gap-4">
        {METRICS.map((m, i) => (
          <MetricCard key={m.label} {...m} delay={i * 120} />
        ))}
      </div>

      {/* Activity Timeline */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(20,27,45,0.97) 0%, rgba(15,21,35,0.98) 100%)',
          border: '1px solid rgba(30,42,61,0.9)',
          boxShadow: '0 2px 16px rgba(0,0,0,0.3)',
        }}
      >
        {/* Card header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'rgba(30,42,61,0.9)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{
                background: 'rgba(99,102,241,0.12)',
                border: '1px solid rgba(99,102,241,0.22)',
              }}
            >
              <RefreshCw className="w-3.5 h-3.5 text-indigo-400" strokeWidth={2} />
            </div>
            <div>
              <div className="text-sm font-semibold text-text-primary">Activity Timeline</div>
              <div className="text-[11px] text-text-muted">Latest events across all active migrations</div>
            </div>
          </div>

          {/* Live badge */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
            style={{
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.25)',
              color: '#22C55E',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: '#22C55E', boxShadow: '0 0 6px #22C55E' }}
            />
            Live
          </div>
        </div>

        {/* Timeline entries */}
        <div className="px-2 py-2">
          {TIMELINE.map((entry, i) => (
            <TimelineRow key={entry.id} entry={entry} isLast={i === TIMELINE.length - 1} />
          ))}
        </div>
      </div>

      {/* Bottom system stats bar */}
      <div
        className="grid grid-cols-4 gap-px rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(30,42,61,0.6)',
          border: '1px solid rgba(30,42,61,0.9)',
        }}
      >
        {[
          { label: 'Uptime', value: '99.98%', color: '#22C55E' },
          { label: 'Avg Latency', value: '12 ms', color: '#06B6D4' },
          { label: 'Messages / s', value: '3,241', color: '#6366F1' },
          { label: 'Error Rate', value: '0.02%', color: '#F59E0B' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="flex flex-col items-center justify-center py-4 gap-1 transition-colors duration-200 hover:bg-white/[0.025] cursor-default"
            style={{ background: 'rgba(15,21,35,0.9)' }}
          >
            <span className="text-[11px] text-text-muted font-medium uppercase tracking-widest">{label}</span>
            <span className="text-lg font-bold tabular-nums" style={{ color }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
