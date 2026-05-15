import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, ArrowRightLeft, ShieldCheck, TrendingUp, AlertTriangle,
  RotateCcw, CheckCircle2, XCircle, Activity, Layers, Radio, Zap,
  Users, Terminal, ChevronRight, GitBranch,
} from 'lucide-react';
import MigrationHeader from '../components/MigrationHeader';
import { useWorkspaceStore } from '../store/workspaceStore';
import { format } from 'date-fns';

// ── Types ────────────────────────────────────────────────────────────────────

type ActivePath = 'source' | 'target' | 'split';

interface ValidationMetrics {
  latency: { source: number; target: number };
  errorRate: { source: number; target: number };
  queueDepth: { source: number; target: number };
  consumersUp: { source: string; target: string };
  activeChannels: { source: number; target: number };
  throughput: { source: number; target: number };
}

interface ValidationResult {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'warning';
  detail?: string;
  latency?: number;
}

interface TrafficParticle {
  id: string;
  path: 'source' | 'target';
  progress: number;
}

// ── Mini Topology SVG ────────────────────────────────────────────────────────

const SOURCE_NODES = [
  { id: 'src-prod',  label: 'PaymentAPI', sub: 'Producer',   color: '#22d3ee', x: 10  },
  { id: 'src-qm',   label: 'PAY.QM1',    sub: 'Source QM',  color: '#3b82f6', x: 160 },
  { id: 'src-ch',   label: 'CH.PAY',     sub: 'Channel',    color: '#64748b', x: 310 },
  { id: 'src-cons', label: 'LedgerSvc',  sub: 'Consumer',   color: '#22c55e', x: 460 },
];

const TARGET_NODES = [
  { id: 'tgt-prod',  label: 'PaymentAPI',     sub: 'Producer',  color: '#22d3ee', x: 10  },
  { id: 'tgt-qm',   label: 'CLOUD.PAY.QM1',  sub: 'Target QM', color: '#f59e0b', x: 160 },
  { id: 'tgt-ch',   label: 'CH.CLOUD',        sub: 'Channel',   color: '#64748b', x: 310 },
  { id: 'tgt-cons', label: 'LedgerSvc',       sub: 'Consumer',  color: '#22c55e', x: 460 },
];

function MiniTopology({
  nodes,
  active,
  pathColor,
  particles,
  label,
  glowColor,
}: {
  nodes: typeof SOURCE_NODES;
  active: boolean;
  pathColor: string;
  particles: TrafficParticle[];
  label: string;
  glowColor: string;
}) {
  const W = 580;
  const H = 96;
  const NODE_W = 100;
  const NODE_H = 52;
  const NODE_Y = (H - NODE_H) / 2;
  const EDGE_Y = H / 2;
  const particlePath = label === 'SOURCE PATH' ? 'source' : 'target';

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: active ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.2)',
        border: `1px solid ${active ? glowColor + '60' : 'rgba(255,255,255,0.06)'}`,
        boxShadow: active ? `0 0 20px ${glowColor}18, inset 0 0 40px ${glowColor}06` : 'none',
        transition: 'all 0.5s ease',
      }}
    >
      <div className="px-3 pt-2 pb-0 flex items-center gap-2">
        <div
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{
            background: active ? glowColor : '#374151',
            boxShadow: active ? `0 0 6px ${glowColor}` : 'none',
            transition: 'all 0.4s',
          }}
        />
        <span
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: active ? glowColor : '#4b5563', transition: 'color 0.4s' }}
        >
          {label}
        </span>
        {active && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded font-mono"
            style={{ background: glowColor + '20', color: glowColor, border: `1px solid ${glowColor}40` }}
          >
            ACTIVE
          </motion.span>
        )}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id={`glow-topo-${particlePath}`} x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {nodes.slice(0, -1).map((n, i) => {
          const x1 = n.x + NODE_W;
          const x2 = nodes[i + 1].x;
          return (
            <g key={`edge-${i}`}>
              <line
                x1={x1} y1={EDGE_Y} x2={x2} y2={EDGE_Y}
                stroke={active ? pathColor : '#1e2a3d'}
                strokeWidth={active ? 1.5 : 1}
                strokeDasharray={active ? 'none' : '4 3'}
                style={{ transition: 'stroke 0.5s, stroke-width 0.5s' }}
              />
              {active && (
                <polygon
                  points={`${x2 - 6},${EDGE_Y - 4} ${x2},${EDGE_Y} ${x2 - 6},${EDGE_Y + 4}`}
                  fill={pathColor}
                  opacity={0.7}
                />
              )}
            </g>
          );
        })}

        {nodes.map((node) => (
          <g key={node.id} transform={`translate(${node.x}, ${NODE_Y})`}>
            {active && (
              <rect
                x={-2} y={-2} width={NODE_W + 4} height={NODE_H + 4} rx={10}
                fill="none" stroke={node.color} strokeWidth={1} strokeOpacity={0.35}
                style={{ filter: `drop-shadow(0 0 6px ${node.color})` }}
              >
                <animate attributeName="strokeOpacity" values="0.35;0.75;0.35" dur="2s" repeatCount="indefinite" />
              </rect>
            )}
            <rect
              x={0} y={0} width={NODE_W} height={NODE_H} rx={9}
              fill={active ? `${node.color}14` : 'rgba(14,20,35,0.7)'}
              stroke={active ? node.color : '#1e2a3d'}
              strokeWidth={active ? 1.5 : 1}
              style={{ transition: 'fill 0.5s, stroke 0.5s' }}
            />
            <text x={NODE_W / 2} y={20} textAnchor="middle" fontSize={9} fontWeight={700} fill={active ? node.color : '#374151'}>
              {node.label}
            </text>
            <text x={NODE_W / 2} y={33} textAnchor="middle" fontSize={8} fill={active ? '#6b7280' : '#374151'}>
              {node.sub}
            </text>
            {active && (
              <circle cx={NODE_W - 8} cy={10} r={3} fill={node.color} style={{ filter: `drop-shadow(0 0 3px ${node.color})` }}>
                <animate attributeName="opacity" values="1;0.3;1" dur="1.4s" repeatCount="indefinite" />
              </circle>
            )}
          </g>
        ))}

        {particles
          .filter((p) => p.path === particlePath)
          .map((p) => {
            const totalSegs = nodes.length - 1;
            const segIdx = Math.min(Math.floor(p.progress * totalSegs), totalSegs - 1);
            const segProg = p.progress * totalSegs - segIdx;
            const x1 = nodes[segIdx].x + NODE_W;
            const x2 = nodes[segIdx + 1].x;
            const px = x1 + (x2 - x1) * Math.min(segProg, 1);
            return (
              <g key={p.id} filter={`url(#glow-topo-${particlePath})`}>
                <circle cx={px} cy={EDGE_Y} r={5} fill={pathColor} opacity={0.9} />
                <circle cx={px} cy={EDGE_Y} r={2} fill="white" opacity={0.95} />
              </g>
            );
          })}
      </svg>
    </div>
  );
}

// ── Traffic Shift Slider ─────────────────────────────────────────────────────

function TrafficSlider({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  const srcPct = 100 - value;
  const tgtPct = value;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: '#22d3ee', boxShadow: '0 0 6px #22d3ee' }} />
          <span className="text-xs font-bold" style={{ color: '#22d3ee' }}>SOURCE {srcPct}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ArrowRightLeft className="w-3.5 h-3.5 text-text-muted" />
          <span className="text-[10px] text-text-muted font-mono">Traffic Split</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold" style={{ color: '#f59e0b' }}>TARGET {tgtPct}%</span>
          <div className="w-2 h-2 rounded-full" style={{ background: '#f59e0b', boxShadow: '0 0 6px #f59e0b' }} />
        </div>
      </div>

      <div className="relative h-7 flex items-center">
        <div
          className="absolute inset-x-0 h-2 rounded-full overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <motion.div
            className="absolute left-0 top-0 h-full"
            animate={{ width: `${srcPct}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            style={{ background: 'linear-gradient(90deg, #0891b2, #22d3ee)', boxShadow: '2px 0 8px rgba(34,211,238,0.4)' }}
          />
          <motion.div
            className="absolute right-0 top-0 h-full"
            animate={{ width: `${tgtPct}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            style={{ background: 'linear-gradient(90deg, #d97706, #f59e0b)', boxShadow: '-2px 0 8px rgba(245,158,11,0.4)' }}
          />
        </div>

        <input
          type="range" min={0} max={100} step={5} value={value} disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-x-0 h-full w-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          style={{ zIndex: 10 }}
        />

        <motion.div
          className="absolute w-5 h-5 rounded-full border-2 pointer-events-none z-20 flex items-center justify-center"
          animate={{ left: `calc(${value}% - 10px)` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          style={{
            background: '#0f1523',
            borderColor: value === 0 ? '#22d3ee' : value === 100 ? '#f59e0b' : '#64748b',
            boxShadow: `0 0 10px ${value === 0 ? 'rgba(34,211,238,0.5)' : value === 100 ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.15)'}`,
          }}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{
            background: value === 0 ? '#22d3ee' : value === 100 ? '#f59e0b' : '#94a3b8',
          }} />
        </motion.div>
      </div>

      <div className="flex justify-between text-[9px] text-text-muted font-mono px-0.5">
        {[0, 25, 50, 75, 100].map((v) => (
          <span key={v} style={{ color: v === value ? '#94a3b8' : undefined }}>{v}%</span>
        ))}
      </div>
    </div>
  );
}

// ── Metric Row ───────────────────────────────────────────────────────────────

function MetricRow({
  label, icon, srcValue, tgtValue, unit, srcColor, tgtColor, highlight,
}: {
  label: string;
  icon: React.ReactNode;
  srcValue: string | number;
  tgtValue: string | number;
  unit?: string;
  srcColor?: string;
  tgtColor?: string;
  highlight?: boolean;
}) {
  return (
    <motion.div
      layout
      className="rounded-xl p-3 flex flex-col gap-2"
      style={{
        background: highlight ? 'rgba(34,211,238,0.04)' : 'var(--surface-card)',
        border: `1px solid ${highlight ? 'rgba(34,211,238,0.2)' : 'var(--surface-border)'}`,
      }}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-text-muted">{icon}</span>
        <span className="text-[10px] text-text-muted uppercase tracking-widest font-semibold">{label}</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-center flex-1">
          <div className="text-[9px] text-text-muted mb-0.5">SOURCE</div>
          <span
            className="text-lg font-bold font-mono tabular-nums"
            style={{ color: srcColor ?? '#22d3ee', textShadow: `0 0 10px ${(srcColor ?? '#22d3ee') + '66'}` }}
          >
            {typeof srcValue === 'number' ? srcValue.toLocaleString() : srcValue}
            {unit && <span className="text-xs font-normal text-text-muted ml-0.5">{unit}</span>}
          </span>
        </div>
        <div className="w-px h-8 mx-2" style={{ background: 'var(--surface-border)' }} />
        <div className="text-center flex-1">
          <div className="text-[9px] text-text-muted mb-0.5">TARGET</div>
          <span
            className="text-lg font-bold font-mono tabular-nums"
            style={{ color: tgtColor ?? '#f59e0b', textShadow: `0 0 10px ${(tgtColor ?? '#f59e0b') + '66'}` }}
          >
            {typeof tgtValue === 'number' ? tgtValue.toLocaleString() : tgtValue}
            {unit && <span className="text-xs font-normal text-text-muted ml-0.5">{unit}</span>}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Validation Check Row ─────────────────────────────────────────────────────

function ValidationCheckRow({ check, index }: { check: ValidationResult; index: number }) {
  const style: Record<string, { color: string; icon: React.ReactNode }> = {
    passed:  { color: '#22c55e', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    failed:  { color: '#ef4444', icon: <XCircle className="w-3.5 h-3.5" /> },
    warning: { color: '#f59e0b', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    running: {
      color: '#22d3ee',
      icon: (
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
          <Activity className="w-3.5 h-3.5" />
        </motion.div>
      ),
    },
    pending: { color: '#374151', icon: <div className="w-3.5 h-3.5 rounded-full border border-current" /> },
  };
  const s = style[check.status] ?? style.pending;
  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
      style={{ background: check.status === 'running' ? 'rgba(34,211,238,0.04)' : 'transparent' }}
    >
      <span style={{ color: s.color }}>{s.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-text-secondary font-medium truncate">{check.label}</div>
        {check.detail && <div className="text-[10px] text-text-muted truncate">{check.detail}</div>}
      </div>
      {check.latency !== undefined && check.status === 'passed' && (
        <span className="text-[10px] font-mono text-text-muted shrink-0">{check.latency}ms</span>
      )}
    </motion.div>
  );
}

// ── Log style ────────────────────────────────────────────────────────────────

const LEVEL_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  INFO:    { color: '#9ca3af', bg: 'transparent',           label: 'INFO' },
  WARNING: { color: '#f59e0b', bg: 'rgba(245,158,11,0.05)', label: 'WARN' },
  ERROR:   { color: '#ef4444', bg: 'rgba(239,68,68,0.05)',  label: 'ERR ' },
  SUCCESS: { color: '#22c55e', bg: 'rgba(34,197,94,0.05)',  label: 'SUCC' },
};

// ── Constants ─────────────────────────────────────────────────────────────────

const INITIAL_METRICS: ValidationMetrics = {
  latency:        { source: 42,    target: 38    },
  errorRate:      { source: 0.02,  target: 0.01  },
  queueDepth:     { source: 11,    target: 0     },
  consumersUp:    { source: '2/2', target: '0/2' },
  activeChannels: { source: 3,     target: 0     },
  throughput:     { source: 12455, target: 0     },
};

const PENDING_CHECKS: ValidationResult[] = [
  { id: 'chk-reach',      label: 'QM Reachability',      status: 'pending' },
  { id: 'chk-tls',        label: 'TLS / mTLS Handshake', status: 'pending' },
  { id: 'chk-ccdt',       label: 'CCDT Auth Binding',    status: 'pending' },
  { id: 'chk-queues',     label: 'Queue Definitions',     status: 'pending' },
  { id: 'chk-channels',   label: 'Channel Config',        status: 'pending' },
  { id: 'chk-dlq',        label: 'DLQ Policy',            status: 'pending' },
  { id: 'chk-roundtrip',  label: 'Message Roundtrip',     status: 'pending' },
  { id: 'chk-ordering',   label: 'Message Ordering',      status: 'pending' },
  { id: 'chk-throughput', label: 'Throughput Baseline',   status: 'pending' },
];

const PASSED_CHECKS: ValidationResult[] = [
  { id: 'chk-reach',      label: 'QM Reachability',      status: 'passed',  detail: 'CLOUD.PAY.QM1 reachable',     latency: 11  },
  { id: 'chk-tls',        label: 'TLS / mTLS Handshake', status: 'passed',  detail: 'mTLS v1.3 verified',          latency: 7   },
  { id: 'chk-ccdt',       label: 'CCDT Auth Binding',    status: 'passed',  detail: 'Service account bound',       latency: 4   },
  { id: 'chk-queues',     label: 'Queue Definitions',     status: 'passed',  detail: '14 queues provisioned',       latency: 19  },
  { id: 'chk-channels',   label: 'Channel Config',        status: 'passed',  detail: '3 channels configured',       latency: 14  },
  { id: 'chk-dlq',        label: 'DLQ Policy',            status: 'passed',  detail: 'DLQ policy applied',          latency: 6   },
  { id: 'chk-roundtrip',  label: 'Message Roundtrip',     status: 'passed',  detail: 'Probe delivered in 38ms',     latency: 38  },
  { id: 'chk-ordering',   label: 'Message Ordering',      status: 'passed',  detail: 'FIFO order maintained',       latency: 10  },
  { id: 'chk-throughput', label: 'Throughput Baseline',   status: 'passed',  detail: '12,120 msg/min (above SLA)', latency: 0   },
];

// ── Main Component ────────────────────────────────────────────────────────────

export default function TargetValidation() {
  const navigate = useNavigate();
  const {
    setStep,
    addRuntimeLog,
    addTimelineEvent,
    setTrafficSplit: storeSetSplit,
    trafficSplit: storedSplit,
  } = useWorkspaceStore();

  const [activePath, setActivePath] = useState<ActivePath>('source');
  const [trafficSplit, setTrafficSplitLocal] = useState(storedSplit ?? 0);
  const [checks, setChecks] = useState<ValidationResult[]>(PENDING_CHECKS);
  const [isValidating, setIsValidating] = useState(false);
  const [validationDone, setValidationDone] = useState(false);
  const [isPromoted, setIsPromoted] = useState(false);
  const [metrics, setMetrics] = useState<ValidationMetrics>(INITIAL_METRICS);
  const [particles, setParticles] = useState<TrafficParticle[]>([]);
  const [logs, setLogs] = useState<Array<{ id: string; timestamp: number; level: string; service: string; message: string }>>([]);

  const logBottomRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    logBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
  }, []);

  const appendLog = useCallback((level: string, service: string, message: string) => {
    const entry = { id: `log-${Date.now()}-${Math.random()}`, timestamp: Date.now(), level, service, message };
    setLogs((prev) => [...prev, entry]);
    addRuntimeLog({ level: level as 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS', service, message });
  }, [addRuntimeLog]);

  // Spawn traffic particles based on split
  useEffect(() => {
    if (trafficSplit === 0 && activePath === 'source') return;
    const interval = setInterval(() => {
      const newParticles: TrafficParticle[] = [];
      if (trafficSplit < 100 && Math.random() < (100 - trafficSplit) / 75) {
        newParticles.push({ id: `src-${Date.now()}-${Math.random()}`, path: 'source', progress: 0 });
      }
      if (trafficSplit > 0 && Math.random() < trafficSplit / 75) {
        newParticles.push({ id: `tgt-${Date.now()}-${Math.random()}`, path: 'target', progress: 0 });
      }
      if (newParticles.length > 0) {
        setParticles((prev) => [...prev.slice(-24), ...newParticles]);
      }
    }, 280);
    return () => clearInterval(interval);
  }, [activePath, trafficSplit]);

  // Advance particles
  useEffect(() => {
    const raf = setInterval(() => {
      setParticles((prev) =>
        prev.map((p) => ({ ...p, progress: p.progress + 0.025 })).filter((p) => p.progress < 1)
      );
    }, 40);
    return () => clearInterval(raf);
  }, []);

  const handleValidateTarget = useCallback(() => {
    if (isValidating || validationDone) return;
    setIsValidating(true);
    setChecks(PENDING_CHECKS);
    appendLog('INFO', 'TargetValidation', 'Starting target topology validation — CLOUD.PAY.QM1…');

    PENDING_CHECKS.forEach((check, i) => {
      schedule(() => {
        setChecks((prev) => prev.map((c) => c.id === check.id ? { ...c, status: 'running' } : c));
      }, i * 380 + 150);
      schedule(() => {
        const passed = PASSED_CHECKS.find((c) => c.id === check.id)!;
        setChecks((prev) => prev.map((c) => c.id === check.id ? passed : c));
        appendLog('SUCCESS', check.label, passed.detail ?? 'Check passed');
      }, i * 380 + 620);
    });

    schedule(() => {
      setIsValidating(false);
      setValidationDone(true);
      setMetrics((m) => ({
        ...m,
        consumersUp:    { ...m.consumersUp,    target: '2/2' },
        activeChannels: { ...m.activeChannels, target: 3     },
        throughput:     { ...m.throughput,     target: 12120 },
      }));
      appendLog('SUCCESS', 'TargetValidation', 'All checks passed — target topology ready for traffic');
      addTimelineEvent({
        type: 'success',
        title: 'Target Validation Passed',
        detail: 'CLOUD.PAY.QM1 fully validated — ready for traffic shift',
        step: 'target-validation',
      });
    }, PENDING_CHECKS.length * 380 + 700);
  }, [isValidating, validationDone, appendLog, schedule, addTimelineEvent]);

  const handleShiftTraffic = useCallback(() => {
    if (!validationDone || isPromoted) return;
    const next = Math.min(trafficSplit + 25, 100);
    setTrafficSplitLocal(next);
    storeSetSplit(next);
    setActivePath(next === 100 ? 'target' : next === 0 ? 'source' : 'split');
    appendLog('INFO', 'TrafficController', `Traffic shift: SOURCE ${100 - next}% → TARGET ${next}%`);
    setMetrics((m) => ({
      ...m,
      queueDepth: { source: Math.max(0, 11 - Math.floor(next / 10)), target: Math.floor(next / 10) },
      throughput: { source: Math.floor(12455 * (100 - next) / 100), target: Math.floor(12120 * next / 100) },
    }));
  }, [validationDone, isPromoted, trafficSplit, storeSetSplit, appendLog]);

  const handleManualSlider = useCallback((v: number) => {
    if (!validationDone || isPromoted) return;
    setTrafficSplitLocal(v);
    storeSetSplit(v);
    setActivePath(v === 0 ? 'source' : v === 100 ? 'target' : 'split');
  }, [validationDone, isPromoted, storeSetSplit]);

  const handlePromote = useCallback(() => {
    if (!validationDone || isPromoted) return;
    setTrafficSplitLocal(100);
    storeSetSplit(100);
    setActivePath('target');
    setIsPromoted(true);
    setMetrics((m) => ({
      ...m,
      queueDepth:     { source: 0,     target: 11    },
      throughput:     { source: 0,     target: 12455 },
      consumersUp:    { source: '0/2', target: '2/2' },
      activeChannels: { source: 0,     target: 3     },
    }));
    appendLog('SUCCESS', 'TrafficController', 'Target promoted — 100% traffic on CLOUD.PAY.QM1');
    addTimelineEvent({
      type: 'success',
      title: 'Target Promoted',
      detail: 'All traffic shifted to CLOUD.PAY.QM1 — migration complete',
      step: 'target-validation',
    });
    setStep('summary');
    schedule(() => navigate('/migration/summary'), 1200);
  }, [validationDone, isPromoted, appendLog, addTimelineEvent, setStep, schedule, navigate]);

  const handleRollback = useCallback(() => {
    setActivePath('source');
    setTrafficSplitLocal(0);
    storeSetSplit(0);
    setIsPromoted(false);
    setMetrics(INITIAL_METRICS);
    setChecks(PENDING_CHECKS);
    setValidationDone(false);
    setIsValidating(false);
    setLogs([]);
    appendLog('WARNING', 'TrafficController', 'Rollback — traffic fully restored to SOURCE PAY.QM1');
    addTimelineEvent({
      type: 'warning',
      title: 'Rollback Executed',
      detail: 'Traffic returned to PAY.QM1 — target validation reset',
      step: 'target-validation',
    });
  }, [storeSetSplit, appendLog, addTimelineEvent]);

  const passedCount = checks.filter((c) => c.status === 'passed').length;
  const srcActive = activePath === 'source' || activePath === 'split';
  const tgtActive = activePath === 'target' || activePath === 'split';

  return (
    <div className="flex flex-col h-full -m-6 overflow-hidden">
      <MigrationHeader />

      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── LEFT: Controls + Checks ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35 }}
          className="w-[296px] shrink-0 border-r border-surface-border flex flex-col overflow-hidden"
          style={{ background: 'var(--surface-raised)' }}
        >
          <div className="px-4 py-2.5 border-b border-surface-border flex items-center gap-2 shrink-0">
            <div className="w-2 h-2 rounded-full" style={{ background: '#f59e0b', boxShadow: '0 0 6px #f59e0b' }} />
            <span className="text-xs font-semibold text-text-primary">Target Validation</span>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full border border-amber-400/30 text-amber-400 font-mono">
              CLOUD.PAY.QM1
            </span>
          </div>

          {/* Route selector */}
          <div className="px-4 py-3 border-b border-surface-border shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <GitBranch className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-[10px] text-text-muted uppercase tracking-widest font-semibold">Active Route</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(['source', 'split', 'target'] as const).map((p) => (
                <button
                  key={p}
                  disabled={!validationDone}
                  onClick={() => {
                    if (!validationDone) return;
                    setActivePath(p);
                    const v = p === 'source' ? 0 : p === 'target' ? 100 : 50;
                    setTrafficSplitLocal(v);
                    storeSetSplit(v);
                  }}
                  className="py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wide transition-all"
                  style={{
                    background: activePath === p
                      ? p === 'source' ? 'rgba(34,211,238,0.15)' : p === 'target' ? 'rgba(245,158,11,0.15)' : 'rgba(100,116,139,0.2)'
                      : 'var(--surface-card)',
                    border: `1px solid ${activePath === p
                      ? p === 'source' ? 'rgba(34,211,238,0.4)' : p === 'target' ? 'rgba(245,158,11,0.4)' : 'rgba(100,116,139,0.4)'
                      : 'var(--surface-border)'}`,
                    color: activePath === p
                      ? p === 'source' ? '#22d3ee' : p === 'target' ? '#f59e0b' : '#94a3b8'
                      : '#4b5563',
                    cursor: validationDone ? 'pointer' : 'not-allowed',
                    opacity: validationDone ? 1 : 0.5,
                  }}
                >
                  {p === 'split' ? '50/50' : p}
                </button>
              ))}
            </div>
          </div>

          {/* Validation checks */}
          <div className="flex-1 overflow-y-auto px-3 py-2">
            <div className="flex items-center gap-2 mb-2 px-1">
              <ShieldCheck className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-[10px] text-text-muted uppercase tracking-widest font-semibold">Target Checks</span>
              <span
                className="ml-auto text-[10px] font-mono"
                style={{ color: validationDone ? '#22c55e' : isValidating ? '#22d3ee' : '#4b5563' }}
              >
                {passedCount}/{checks.length}
              </span>
            </div>

            <div className="h-1 rounded-full overflow-hidden mb-3" style={{ background: 'var(--surface-card)' }}>
              <motion.div
                className="h-full rounded-full"
                animate={{ width: `${(passedCount / checks.length) * 100}%` }}
                transition={{ type: 'spring', stiffness: 80, damping: 20 }}
                style={{
                  background: validationDone
                    ? 'linear-gradient(90deg, #15803d, #22c55e)'
                    : 'linear-gradient(90deg, #0891b2, #22d3ee)',
                }}
              />
            </div>

            <div className="space-y-0.5">
              {checks.map((check, i) => (
                <ValidationCheckRow key={check.id} check={check} index={i} />
              ))}
            </div>

            <AnimatePresence>
              {validationDone && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-3 rounded-xl p-3 flex items-center gap-2"
                  style={{
                    background: 'rgba(34,197,94,0.08)',
                    border: '1px solid rgba(34,197,94,0.25)',
                    boxShadow: '0 0 16px rgba(34,197,94,0.08)',
                  }}
                >
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-green-400">Target Ready</div>
                    <div className="text-[10px] text-green-600">Safe to promote</div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Actions */}
          <div className="px-3 py-3 border-t border-surface-border space-y-2 shrink-0">
            <motion.button
              whileHover={{ scale: isValidating || validationDone ? 1 : 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleValidateTarget}
              disabled={isValidating || validationDone}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: validationDone
                  ? 'rgba(34,197,94,0.08)'
                  : isValidating
                  ? 'rgba(34,211,238,0.06)'
                  : 'linear-gradient(135deg, #d97706, #f59e0b)',
                color: validationDone ? '#22c55e' : isValidating ? '#22d3ee' : '#fff',
                border: `1px solid ${validationDone ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
                cursor: isValidating || validationDone ? 'not-allowed' : 'pointer',
                boxShadow: !isValidating && !validationDone ? '0 0 14px rgba(245,158,11,0.3)' : 'none',
              }}
            >
              {validationDone ? (
                <><CheckCircle2 className="w-3.5 h-3.5" />Validated</>
              ) : isValidating ? (
                <>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                    <Activity className="w-3.5 h-3.5" />
                  </motion.div>
                  Validating…
                </>
              ) : (
                <><ShieldCheck className="w-3.5 h-3.5" />Validate Target</>
              )}
            </motion.button>

            <div className="grid grid-cols-2 gap-2">
              <motion.button
                whileHover={{ scale: validationDone && !isPromoted ? 1.02 : 1 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleShiftTraffic}
                disabled={!validationDone || isPromoted}
                className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: validationDone && !isPromoted ? 'rgba(34,211,238,0.1)' : 'rgba(255,255,255,0.03)',
                  color: validationDone && !isPromoted ? '#22d3ee' : '#374151',
                  border: `1px solid ${validationDone && !isPromoted ? 'rgba(34,211,238,0.3)' : 'var(--surface-border)'}`,
                  cursor: validationDone && !isPromoted ? 'pointer' : 'not-allowed',
                }}
              >
                <ArrowRightLeft className="w-3 h-3" />
                Shift +25%
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleRollback}
                className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  color: '#ef4444',
                  border: '1px solid rgba(239,68,68,0.25)',
                }}
              >
                <RotateCcw className="w-3 h-3" />
                Rollback
              </motion.button>
            </div>

            <motion.button
              whileHover={{ scale: validationDone && !isPromoted ? 1.02 : 1 }}
              whileTap={{ scale: 0.98 }}
              onClick={handlePromote}
              disabled={!validationDone || isPromoted}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all"
              style={{
                background: validationDone && !isPromoted
                  ? 'linear-gradient(135deg, #065f46, #059669)'
                  : isPromoted
                  ? 'rgba(34,197,94,0.08)'
                  : 'rgba(255,255,255,0.03)',
                color: validationDone && !isPromoted ? '#fff' : isPromoted ? '#22c55e' : '#374151',
                border: `1px solid ${validationDone && !isPromoted ? 'rgba(16,185,129,0.4)' : isPromoted ? 'rgba(34,197,94,0.3)' : 'var(--surface-border)'}`,
                cursor: validationDone && !isPromoted ? 'pointer' : 'not-allowed',
                boxShadow: validationDone && !isPromoted ? '0 0 16px rgba(16,185,129,0.3)' : 'none',
              }}
            >
              {isPromoted ? (
                <><CheckCircle2 className="w-3.5 h-3.5" />Promoted — Proceeding…</>
              ) : (
                <><TrendingUp className="w-3.5 h-3.5" />Promote Target<ArrowRight className="w-3 h-3" /></>
              )}
            </motion.button>

            <button
              className="btn-ghost w-full text-xs justify-center"
              onClick={() => navigate('/migration/config-redeploy')}
            >
              Back to Config
            </button>
          </div>
        </motion.div>

        {/* ── CENTER: Topology + Slider + Console ──────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 flex flex-col p-4 gap-3 overflow-y-auto min-h-0">

            <div className="shrink-0 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Radio className="w-3.5 h-3.5 text-text-muted" />
                <span className="text-xs font-semibold text-text-primary">Live Topology Comparison</span>
                <AnimatePresence>
                  {(srcActive || tgtActive) && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-mono"
                      style={{ background: 'rgba(34,211,238,0.08)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.2)' }}
                    >
                      LIVE
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              <MiniTopology
                nodes={SOURCE_NODES}
                active={srcActive}
                pathColor="#22d3ee"
                particles={particles}
                label="SOURCE PATH"
                glowColor="#22d3ee"
              />

              {/* VS divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: 'var(--surface-border)' }} />
                <div
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold"
                  style={{ background: 'var(--surface-card)', border: '1px solid var(--surface-border)', color: '#4b5563' }}
                >
                  <motion.span
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    style={{ color: '#22d3ee' }}
                  >
                    {100 - trafficSplit}%
                  </motion.span>
                  <span className="text-text-muted">vs</span>
                  <motion.span
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                    style={{ color: '#f59e0b' }}
                  >
                    {trafficSplit}%
                  </motion.span>
                </div>
                <div className="flex-1 h-px" style={{ background: 'var(--surface-border)' }} />
              </div>

              <MiniTopology
                nodes={TARGET_NODES}
                active={tgtActive}
                pathColor="#f59e0b"
                particles={particles}
                label="TARGET PATH"
                glowColor="#f59e0b"
              />
            </div>

            {/* Traffic slider */}
            <motion.div
              layout
              className="rounded-2xl p-4 shrink-0"
              style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--surface-border)' }}
            >
              <TrafficSlider value={trafficSplit} onChange={handleManualSlider} disabled={!validationDone || isPromoted} />
            </motion.div>

            {/* Console */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex-1 min-h-[140px] rounded-xl flex flex-col overflow-hidden"
              style={{ background: 'rgba(0,0,0,0.38)', border: '1px solid var(--surface-border)' }}
            >
              <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-border shrink-0">
                <Terminal className="w-3.5 h-3.5 text-text-muted" />
                <span className="text-xs font-semibold text-text-primary">Migration Console</span>
                <span className="ml-auto text-[11px] text-text-muted font-mono">{logs.length} entries</span>
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              </div>
              <div className="flex-1 overflow-y-auto" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {logs.length === 0 ? (
                  <div className="flex items-center gap-2 px-3 py-2 text-[11px]">
                    <span className="text-text-muted">$</span>
                    <span className="text-text-muted">Awaiting validation…</span>
                    <span className="inline-block w-2 h-3 bg-text-muted animate-pulse ml-0.5" />
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {logs.map((entry) => {
                      const s = LEVEL_STYLE[entry.level] ?? LEVEL_STYLE.INFO;
                      return (
                        <motion.div
                          key={entry.id}
                          initial={{ opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.1 }}
                          className="flex items-start gap-2 px-3 py-0.5 text-[11px] leading-relaxed"
                          style={{ background: s.bg }}
                        >
                          <span className="text-text-muted shrink-0 tabular-nums w-14">{format(entry.timestamp, 'HH:mm:ss')}</span>
                          <span className="shrink-0 font-semibold w-8" style={{ color: s.color }}>{s.label}</span>
                          <span className="shrink-0 min-w-[120px] text-[#a5b4fc]">{entry.service}</span>
                          <span className="text-text-secondary">{entry.message}</span>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
                <div ref={logBottomRef} />
              </div>
            </motion.div>
          </div>
        </div>

        {/* ── RIGHT: Validation Metrics ─────────────────────────────────────── */}
        <motion.aside
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35 }}
          className="w-[264px] shrink-0 border-l border-surface-border flex flex-col overflow-hidden"
          style={{ background: 'var(--surface-raised)' }}
        >
          <div className="px-4 py-2.5 border-b border-surface-border flex items-center gap-2 shrink-0">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs font-semibold text-text-primary">Validation Metrics</span>
            <motion.div
              className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <MetricRow
              label="Latency"
              icon={<Zap className="w-3 h-3" />}
              srcValue={metrics.latency.source}
              tgtValue={metrics.latency.target}
              unit="ms"
              tgtColor={metrics.latency.target <= metrics.latency.source ? '#22c55e' : '#f59e0b'}
            />
            <MetricRow
              label="Error Rate"
              icon={<AlertTriangle className="w-3 h-3" />}
              srcValue={metrics.errorRate.source}
              tgtValue={metrics.errorRate.target}
              unit="%"
              tgtColor={metrics.errorRate.target <= metrics.errorRate.source ? '#22c55e' : '#ef4444'}
            />
            <MetricRow
              label="Queue Depth"
              icon={<Layers className="w-3 h-3" />}
              srcValue={metrics.queueDepth.source}
              tgtValue={metrics.queueDepth.target}
            />
            <MetricRow
              label="Consumer Health"
              icon={<Users className="w-3 h-3" />}
              srcValue={metrics.consumersUp.source}
              tgtValue={metrics.consumersUp.target}
              tgtColor={metrics.consumersUp.target === '2/2' ? '#22c55e' : '#f59e0b'}
              highlight={metrics.consumersUp.target === '2/2'}
            />
            <MetricRow
              label="Active Channels"
              icon={<GitBranch className="w-3 h-3" />}
              srcValue={metrics.activeChannels.source}
              tgtValue={metrics.activeChannels.target}
              tgtColor={metrics.activeChannels.target > 0 ? '#22c55e' : '#4b5563'}
            />
            <MetricRow
              label="Throughput"
              icon={<TrendingUp className="w-3 h-3" />}
              srcValue={metrics.throughput.source}
              tgtValue={metrics.throughput.target}
              unit="msg/m"
              tgtColor={metrics.throughput.target > 0 ? '#22c55e' : '#4b5563'}
            />

            {/* Status card */}
            <motion.div
              layout
              className="rounded-xl p-3"
              style={{
                background: isPromoted
                  ? 'rgba(34,197,94,0.08)'
                  : validationDone
                  ? 'rgba(34,211,238,0.05)'
                  : 'var(--surface-card)',
                border: `1px solid ${isPromoted ? 'rgba(34,197,94,0.3)' : validationDone ? 'rgba(34,211,238,0.2)' : 'var(--surface-border)'}`,
              }}
            >
              <div className="text-[10px] text-text-muted uppercase tracking-widest mb-2 font-semibold">Migration Status</div>
              <div className="flex items-center gap-2">
                {isPromoted ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-green-400">Complete</div>
                      <div className="text-[10px] text-green-600">100% on CLOUD.PAY.QM1</div>
                    </div>
                  </>
                ) : validationDone ? (
                  <>
                    <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                      <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                    </motion.div>
                    <div>
                      <div className="text-xs font-bold text-cyan-400">Ready to Promote</div>
                      <div className="text-[10px] text-text-muted">Shift traffic or promote</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-4 h-4 rounded-full border border-surface-muted shrink-0 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-surface-muted" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-text-muted">Awaiting Validation</div>
                      <div className="text-[10px] text-text-muted">Run checks to proceed</div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>

            {/* Live split bars */}
            <AnimatePresence>
              {trafficSplit > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl p-3"
                  style={{ background: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}
                >
                  <div className="text-[10px] text-text-muted uppercase tracking-widest mb-2 font-semibold">Live Split</div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <motion.div
                          className="h-full rounded-full"
                          animate={{ width: `${100 - trafficSplit}%` }}
                          style={{ background: 'linear-gradient(90deg, #0891b2, #22d3ee)' }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-cyan-400 w-8 text-right">{100 - trafficSplit}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <motion.div
                          className="h-full rounded-full"
                          animate={{ width: `${trafficSplit}%` }}
                          style={{ background: 'linear-gradient(90deg, #d97706, #f59e0b)' }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-amber-400 w-8 text-right">{trafficSplit}%</span>
                    </div>
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[9px] text-text-muted">PAY.QM1</span>
                    <span className="text-[9px] text-text-muted">CLOUD.PAY.QM1</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all hover:bg-white/5"
              style={{ border: '1px solid var(--surface-border)', color: '#4b5563' }}
              onClick={() => { setStep('summary'); navigate('/migration/summary'); }}
            >
              <span>View Summary</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.aside>
      </div>
    </div>
  );
}


export default TargetValidation