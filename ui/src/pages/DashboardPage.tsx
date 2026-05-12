import { useEffect, useRef, useState } from 'react';
import { Server, RefreshCw, Plus, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, Clock, Activity, Layers, ShieldCheck, GitMerge, Zap, TrendingUp, ChartBar as BarChart2, Radio, Database } from 'lucide-react';
import { useFleet } from '../hooks/useFleet';
import { MOCK_MIGRATIONS } from '../api/mock/data';
import type { MigrationState } from '../types';

// ─── Animated counter ────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1000) {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number>(0);
  useEffect(() => {
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(ease * target));
      if (p < 1) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);
  return value;
}

// ─── Stat card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
  glow: string;
  icon: React.ElementType;
  animate?: boolean;
}

function StatCard({ label, value, sub, accent, glow, icon: Icon, animate }: StatCardProps) {
  const numVal = typeof value === 'number' ? value : parseInt(String(value), 10);
  const animated = useCountUp(animate && !isNaN(numVal) ? numVal : 0, 1200);
  const displayVal = animate && !isNaN(numVal) ? animated : value;

  return (
    <div
      className="relative flex-1 min-w-0 rounded-2xl p-5 card transition-all duration-300 hover:scale-[1.02] cursor-default group overflow-hidden"
    >
      {/* Background glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
        style={{ background: `radial-gradient(circle at 70% 20%, ${glow} 0%, transparent 65%)` }}
      />
      {/* Top accent line */}
      <div
        className="absolute top-0 left-6 right-6 h-px rounded-full"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}88, transparent)` }}
      />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: `${accent}18`,
              border: `1px solid ${accent}30`,
            }}
          >
            <Icon className="w-4 h-4" style={{ color: accent }} strokeWidth={1.8} />
          </div>
          <div
            className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{ background: `${accent}15`, color: accent }}
          >
            LIVE
          </div>
        </div>

        <div className="text-3xl font-bold tabular-nums text-text-primary tracking-tight leading-none mb-1">
          {typeof displayVal === 'number' ? displayVal : value}
        </div>
        <div className="text-xs font-semibold text-text-secondary uppercase tracking-widest mb-1">{label}</div>
        {sub && <div className="text-[11px] text-text-muted">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: 'source' | 'target' }) {
  const isTarget = role === 'target';
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide"
      style={
        isTarget
          ? { background: 'rgba(6,182,212,0.15)', color: '#06B6D4', border: '1px solid rgba(6,182,212,0.3)' }
          : { background: 'rgba(99,102,241,0.12)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.25)' }
      }
    >
      {role === 'target' ? 'Target' : 'Source'}
    </span>
  );
}

// ─── DLQ badge ───────────────────────────────────────────────────────────────

function DLQBadge({ ok, pending }: { ok?: boolean; pending?: boolean }) {
  if (pending) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold"
        style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.25)' }}>
        <AlertTriangle className="w-3 h-3" />
        Pending
      </span>
    );
  }
  if (ok === false) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold"
        style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }}>
        —
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold"
      style={{ background: 'rgba(34,197,94,0.10)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.22)' }}>
      <CheckCircle2 className="w-3 h-3" />
      DLQ
    </span>
  );
}

// ─── Status pill ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { dot: string; text: string; bg: string; border: string }> = {
  Running:      { dot: '#22C55E', text: '#22C55E', bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.22)' },
  Migrated:     { dot: '#06B6D4', text: '#06B6D4', bg: 'rgba(6,182,212,0.10)',  border: 'rgba(6,182,212,0.22)' },
  Provisioning: { dot: '#F59E0B', text: '#F59E0B', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.22)' },
  Pending:      { dot: '#9CA3AF', text: '#9CA3AF', bg: 'rgba(156,163,175,0.10)',border: 'rgba(156,163,175,0.22)' },
  Validating:   { dot: '#818CF8', text: '#818CF8', bg: 'rgba(129,140,248,0.10)',border: 'rgba(129,140,248,0.22)' },
  RolledBack:   { dot: '#EF4444', text: '#EF4444', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.22)' },
  Unknown:      { dot: '#6B7280', text: '#6B7280', bg: 'rgba(107,114,128,0.08)',border: 'rgba(107,114,128,0.18)' },
};

function statusFromMigrationState(state?: MigrationState, qmStatus?: string): string {
  if (!state) {
    if (qmStatus === 'reachable') return 'Running';
    return 'Unknown';
  }
  const map: Record<string, string> = {
    MIGRATED: 'Migrated',
    VALIDATING: 'Validating',
    PROVISIONING_TARGET: 'Provisioning',
    ROLLING_BACK: 'Provisioning',
    ROLLED_BACK: 'RolledBack',
    IDLE: 'Pending',
    REWIRING: 'Provisioning',
  };
  return map[state] ?? 'Unknown';
}

function StatusPill({ label }: { label: string }) {
  const s = STATUS_STYLES[label] ?? STATUS_STYLES.Unknown;
  const isAnimated = label === 'Running' || label === 'Provisioning' || label === 'Validating';
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold"
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}
    >
      <span className="relative flex items-center justify-center w-1.5 h-1.5">
        {isAnimated && (
          <span
            className="absolute w-2.5 h-2.5 rounded-full animate-ping"
            style={{ background: s.dot, opacity: 0.35 }}
          />
        )}
        <span className="w-1.5 h-1.5 rounded-full relative z-10" style={{ background: s.dot }} />
      </span>
      {label}
    </span>
  );
}

// ─── QM Fleet row ─────────────────────────────────────────────────────────────

interface QMRow {
  name: string;
  role: 'source' | 'target';
  apps: string[];
  queues: number;
  channels: number;
  dlqOk?: boolean;
  dlqPending?: boolean;
  status: string;
}

const QUEUE_MAP: Record<string, number> = {
  'QM.SRC.01': 18, 'QM.SRC.02': 20, 'QM.SRC.03': 16,
  'QM.APP1': 8, 'QM.APP2': 8, 'QM.APP3': 8, 'QM.APP4': 6, 'QM.APP5': 0,
};
const CHANNEL_MAP: Record<string, number> = {
  'QM.SRC.01': 6, 'QM.SRC.02': 6, 'QM.SRC.03': 4,
  'QM.APP1': 2, 'QM.APP2': 2, 'QM.APP3': 2, 'QM.APP4': 0, 'QM.APP5': 0,
};

// Build rows from mock data
function buildFleetRows(): QMRow[] {
  const migMap: Record<string, MigrationState> = {};
  for (const m of MOCK_MIGRATIONS) {
    migMap[m.app_id] = m.state;
  }

  return [
    { name: 'QM.SRC.01', role: 'source', apps: ['APP1', 'APP2'], queues: 18, channels: 6, dlqOk: true, status: 'Running' },
    { name: 'QM.SRC.02', role: 'source', apps: ['APP3', 'APP4'], queues: 20, channels: 6, dlqOk: true, status: 'Running' },
    { name: 'QM.SRC.03', role: 'source', apps: ['APP5', 'APP6'], queues: 16, channels: 4, dlqOk: true, status: 'Running' },
    {
      name: 'QM.APP1.TGT', role: 'target', apps: ['APP1'], queues: 8, channels: 2, dlqOk: true,
      status: statusFromMigrationState(migMap['APP1']),
    },
    {
      name: 'QM.APP2.TGT', role: 'target', apps: ['APP2'], queues: 8, channels: 2, dlqOk: true,
      status: statusFromMigrationState(migMap['APP2']),
    },
    {
      name: 'QM.APP3.TGT', role: 'target', apps: ['APP3'], queues: 8, channels: 2, dlqOk: true,
      status: statusFromMigrationState(migMap['APP3']),
    },
    {
      name: 'QM.APP4.TGT', role: 'target', apps: ['APP4'], queues: 6, channels: 0, dlqPending: true,
      status: statusFromMigrationState(migMap['APP4']),
    },
    {
      name: 'QM.APP5.TGT', role: 'target', apps: ['APP5'], queues: 0, channels: 0, dlqOk: false,
      status: statusFromMigrationState(migMap['APP5']),
    },
  ];
}

// ─── Mini spark bar ───────────────────────────────────────────────────────────

function SparkBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm font-bold tabular-nums text-text-primary w-6 text-right">{value}</span>
      <div className="flex-1 h-1.5 rounded-full bg-surface-overlay overflow-hidden min-w-[40px]">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.round((value / max) * 100)}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ─── DashboardPage ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: fleetData } = useFleet();
  const [mounted, setMounted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const rows = buildFleetRows();

  const sourceQMs = rows.filter((r) => r.role === 'source').length;
  const targetQMs = rows.filter((r) => r.role === 'target').length;
  const totalQueues = rows.reduce((s, r) => s + r.queues, 0);
  const activeQueues = totalQueues - 12; // 12 DLQ
  const dlqCount = 12;
  const migratedApps = MOCK_MIGRATIONS.filter((m) => m.state === 'MIGRATED').length;
  const totalApps = MOCK_MIGRATIONS.length;
  const validationOk = MOCK_MIGRATIONS.filter((m) =>
    m.validation_results?.some((v) => v.passed)
  ).length;

  function handleRefresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  }

  return (
    <div
      className="space-y-6"
      style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.4s ease' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight flex items-center gap-2">
            Fleet Dashboard
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: '#EF4444', boxShadow: '0 0 8px #EF4444' }}
            />
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            Real-time status of all queue manager instances
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-text-secondary border border-surface-border bg-surface-raised hover:bg-surface-overlay hover:text-text-primary transition-all duration-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
              boxShadow: '0 4px 14px rgba(6,182,212,0.3)',
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            Provision QM
          </button>
        </div>
      </div>

      {/* Stat cards row */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={Server}
          label="Queue Managers"
          value={sourceQMs + targetQMs}
          sub={`${sourceQMs} source · ${targetQMs} target`}
          accent="#818CF8"
          glow="rgba(129,140,248,0.12)"
          animate
        />
        <StatCard
          icon={Database}
          label="Total Queues"
          value={totalQueues}
          sub={`${activeQueues} active · ${dlqCount} DLQ`}
          accent="#06B6D4"
          glow="rgba(6,182,212,0.12)"
          animate
        />
        <StatCard
          icon={GitMerge}
          label="Migration State"
          value={`${migratedApps}/${totalApps}`}
          sub="apps migrated"
          accent="#F59E0B"
          glow="rgba(245,158,11,0.12)"
        />
        <StatCard
          icon={ShieldCheck}
          label="Validation"
          value="OK"
          sub="all flows passing"
          accent="#22C55E"
          glow="rgba(34,197,94,0.12)"
        />
      </div>

      {/* Secondary metrics strip */}
      <div className="grid grid-cols-4 gap-px rounded-2xl overflow-hidden border border-surface-border bg-surface-border">
        {[
          { label: 'Uptime', value: '99.98%', color: '#22C55E', icon: Activity },
          { label: 'Avg Latency', value: '12 ms', color: '#06B6D4', icon: Zap },
          { label: 'Messages / s', value: '3,241', color: '#818CF8', icon: BarChart2 },
          { label: 'Error Rate', value: '0.02%', color: '#F59E0B', icon: Radio },
        ].map(({ label, value, color, icon: Icon }) => (
          <div
            key={label}
            className="flex items-center justify-between px-5 py-3.5 bg-surface-raised hover:bg-surface-overlay transition-colors duration-200 cursor-default group"
          >
            <div className="flex items-center gap-2">
              <Icon className="w-3.5 h-3.5 text-text-muted group-hover:text-text-secondary transition-colors" strokeWidth={1.8} />
              <span className="text-[11px] text-text-muted font-medium uppercase tracking-widest">{label}</span>
            </div>
            <span className="text-base font-bold tabular-nums" style={{ color }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Fleet table */}
      <div className="card overflow-hidden">
        {/* Card header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <div className="flex items-center gap-3">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.25)' }}
            >
              <Layers className="w-3.5 h-3.5" style={{ color: '#06B6D4' }} strokeWidth={2} />
            </div>
            <div>
              <div className="text-sm font-semibold text-text-primary">Queue Manager Fleet</div>
              <div className="text-[11px] text-text-muted">All provisioned queue managers across source and target topology</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
              style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.22)', color: '#22C55E' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-green-400" />
              {rows.filter((r) => r.status === 'Running' || r.status === 'Migrated').length} Healthy
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
              style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.22)', color: '#F59E0B' }}>
              {rows.filter((r) => r.status === 'Provisioning' || r.status === 'Pending').length} Pending
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border">
                {['QM Name', 'Role', 'App / Owner', 'Queues', 'Channels', 'DLQ', 'Status'].map((col) => (
                  <th
                    key={col}
                    className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-text-muted"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.name}
                  className="border-b border-surface-border/60 hover:bg-surface-overlay/40 transition-colors duration-150 group"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  {/* QM Name */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-1.5 h-6 rounded-full shrink-0"
                        style={{
                          background: row.role === 'source'
                            ? 'linear-gradient(180deg, #818CF8, #6366F1)'
                            : 'linear-gradient(180deg, #06B6D4, #0891B2)',
                        }}
                      />
                      <span className="font-mono font-semibold text-text-primary text-[13px] group-hover:text-white transition-colors">
                        {row.name}
                      </span>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-5 py-3.5">
                    <RoleBadge role={row.role} />
                  </td>

                  {/* Apps */}
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {row.apps.map((app) => (
                        <span
                          key={app}
                          className="text-[11px] font-semibold text-text-secondary bg-surface-overlay px-1.5 py-0.5 rounded-md"
                        >
                          {app}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Queues */}
                  <td className="px-5 py-3.5">
                    <SparkBar value={row.queues} max={24} color="#818CF8" />
                  </td>

                  {/* Channels */}
                  <td className="px-5 py-3.5">
                    <SparkBar value={row.channels} max={8} color="#06B6D4" />
                  </td>

                  {/* DLQ */}
                  <td className="px-5 py-3.5">
                    <DLQBadge ok={row.dlqOk} pending={row.dlqPending} />
                  </td>

                  {/* Status */}
                  <td className="px-5 py-3.5">
                    <StatusPill label={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-surface-border bg-surface-raised/40">
          <span className="text-[11px] text-text-muted">
            {rows.length} queue managers · Last synced just now
          </span>
          <div className="flex items-center gap-4 text-[11px] text-text-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Source QMs: {sourceQMs}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#06B6D4' }} />
              Target QMs: {targetQMs}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom row: Migration progress + System health */}
      <div className="grid grid-cols-2 gap-4">
        {/* Migration Progress */}
        <div className="card">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-border">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}
            >
              <TrendingUp className="w-3.5 h-3.5" style={{ color: '#F59E0B' }} strokeWidth={2} />
            </div>
            <div>
              <div className="text-sm font-semibold text-text-primary">Migration Progress</div>
              <div className="text-[11px] text-text-muted">Per-application migration state</div>
            </div>
          </div>
          <div className="px-5 py-4 space-y-3">
            {MOCK_MIGRATIONS.map((m) => {
              const statusLabel = statusFromMigrationState(m.state);
              const s = STATUS_STYLES[statusLabel] ?? STATUS_STYLES.Unknown;
              const pct = m.state === 'MIGRATED' ? 100
                : m.state === 'VALIDATING' ? 75
                : m.state === 'PROVISIONING_TARGET' ? 45
                : m.state === 'REWIRING' ? 60
                : 0;
              return (
                <div key={m.app_id} className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-text-muted w-10 shrink-0">{m.app_id}</span>
                  <div className="flex-1 h-2 rounded-full bg-surface-overlay overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{ width: `${pct}%`, background: s.dot }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold w-20 text-right shrink-0" style={{ color: s.text }}>
                    {statusLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* System Health */}
        <div className="card">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-border">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}
            >
              <ShieldCheck className="w-3.5 h-3.5" style={{ color: '#22C55E' }} strokeWidth={2} />
            </div>
            <div>
              <div className="text-sm font-semibold text-text-primary">System Health</div>
              <div className="text-[11px] text-text-muted">Policy, validation, and connectivity</div>
            </div>
          </div>
          <div className="px-5 py-4 space-y-3">
            {[
              { label: 'TLS Policy', passed: true, detail: 'All channels encrypted' },
              { label: 'Naming Policy', passed: true, detail: 'Convention enforced on all QMs' },
              { label: 'DLQ Policy', passed: true, detail: '7/8 QMs compliant' },
              { label: 'MCA Policy', passed: true, detail: 'Channel auth validated' },
              { label: 'Latency SLA', passed: validationOk >= 2, detail: `${validationOk}/${totalApps} apps within 500ms` },
              { label: 'Connectivity', passed: true, detail: '6/8 QMs reachable' },
            ].map(({ label, passed, detail }) => (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: passed ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
                    }}
                  >
                    {passed
                      ? <CheckCircle2 className="w-3 h-3 text-green-400" />
                      : <AlertTriangle className="w-3 h-3 text-yellow-400" />
                    }
                  </div>
                  <span className="text-xs font-semibold text-text-primary">{label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-text-muted">{detail}</span>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={
                      passed
                        ? { background: 'rgba(34,197,94,0.10)', color: '#22C55E' }
                        : { background: 'rgba(245,158,11,0.10)', color: '#F59E0B' }
                    }
                  >
                    {passed ? 'PASS' : 'WARN'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent activity strip */}
      <div className="card">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-border">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.25)' }}
          >
            <Clock className="w-3.5 h-3.5" style={{ color: '#818CF8' }} strokeWidth={2} />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-text-primary">Recent Activity</div>
            <div className="text-[11px] text-text-muted">Latest events across all active migrations</div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
            style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.22)', color: '#22C55E' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-green-400" />
            Live
          </div>
        </div>
        <div className="divide-y divide-surface-border/50">
          {[
            { time: '14:33:10', app: 'APP4', msg: 'Provisioning target QM · QM.APP4.TGT', state: 'Provisioning', icon: Server },
            { time: '14:32:45', app: 'APP3', msg: 'Baseline validation passed · latency 55ms', state: 'Validating', icon: ShieldCheck },
            { time: '14:32:18', app: 'APP1', msg: 'Migration completed successfully', state: 'Migrated', icon: CheckCircle2 },
            { time: '14:31:55', app: 'APP2', msg: 'Auto-rollback completed · latency 850ms > 500ms', state: 'RolledBack', icon: AlertTriangle },
          ].map(({ time, app, msg, state, icon: Icon }) => {
            const s = STATUS_STYLES[state] ?? STATUS_STYLES.Unknown;
            return (
              <div key={time + app} className="flex items-center gap-4 px-5 py-3 hover:bg-surface-overlay/30 transition-colors cursor-default">
                <span className="text-[11px] font-mono text-text-muted w-14 shrink-0">{time}</span>
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${s.dot}18`, border: `1px solid ${s.dot}30` }}
                >
                  <Icon className="w-3 h-3" style={{ color: s.dot }} strokeWidth={2} />
                </div>
                <span className="text-[11px] font-bold shrink-0" style={{ color: s.dot }}>{app}</span>
                <span className="text-[11px] text-text-secondary flex-1 min-w-0 truncate">{msg}</span>
                <StatusPill label={state} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
