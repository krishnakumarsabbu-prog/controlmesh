import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, Zap, ArrowRight, Server, Database, GitBranch, Cpu, RefreshCw, Download, Play, Shield, Clock, TrendingUp, TrendingDown, Minus, ChevronRight, Circle, Box } from 'lucide-react';
import MigrationHeader from '../components/MigrationHeader';
import MigrationFlowCanvas from '../components/MigrationFlowCanvas';
import { useWorkspaceStore } from '../store/workspaceStore';
import { MOCK_APPLICATIONS, MOCK_FLOWS, MOCK_LIVE_METRICS, MOCK_RUNTIME_LOGS } from '../mock/data';
import type { WorkspaceApplication } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTs(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function statusColor(status: string) {
  if (status === 'healthy') return '#22c55e';
  if (status === 'degraded') return '#f59e0b';
  return '#ef4444';
}

function statusBg(status: string) {
  if (status === 'healthy') return 'rgba(34,197,94,0.1)';
  if (status === 'degraded') return 'rgba(245,158,11,0.1)';
  return 'rgba(239,68,68,0.1)';
}

function logLevelColor(level: string) {
  switch (level) {
    case 'SUCCESS': return '#22c55e';
    case 'WARNING': return '#f59e0b';
    case 'ERROR':   return '#ef4444';
    default:        return '#6b7280';
  }
}

// ── Left Panel — AppCard ──────────────────────────────────────────────────────

function AppCard({ app, selected, onSelect }: { app: WorkspaceApplication; selected: boolean; onSelect: () => void }) {
  const flow = MOCK_FLOWS.find(f => f.appId === app.id);
  const totalTps = [...app.producers, ...app.consumers].reduce((s, sv) => s + sv.tps, 0);

  return (
    <motion.div
      layout
      whileHover={{ x: 2 }}
      onClick={onSelect}
      className="rounded-xl border cursor-pointer transition-all duration-200 overflow-hidden"
      style={{
        background: selected
          ? 'linear-gradient(135deg, rgba(6,182,212,0.1) 0%, rgba(34,211,238,0.05) 100%)'
          : 'var(--surface-card)',
        borderColor: selected ? 'rgba(6,182,212,0.5)' : 'var(--surface-border)',
        boxShadow: selected ? '0 0 20px rgba(6,182,212,0.12)' : 'none',
      }}
    >
      {selected && (
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #22d3ee, rgba(34,211,238,0.3))' }} />
      )}
      <div className="p-3">
        {/* App name + health */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: statusColor(app.status) }} />
              <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{app.name}</span>
            </div>
            <div className="flex items-center gap-1.5 ml-3.5">
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                {app.environment}
              </span>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{app.domain}</span>
            </div>
          </div>
          <div
            className="text-[9px] uppercase font-semibold px-2 py-0.5 rounded-full"
            style={{ background: statusBg(app.status), color: statusColor(app.status) }}
          >
            {app.status}
          </div>
        </div>

        {/* TPS bar */}
        <div className="mb-2.5">
          <div className="flex justify-between text-[10px] mb-1">
            <span style={{ color: 'var(--text-muted)' }}>Traffic</span>
            <span className="font-semibold" style={{ color: '#22d3ee' }}>{totalTps.toLocaleString()} TPS</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--surface-muted)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #22d3ee, #818cf8)' }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((totalTps / 20000) * 100, 100)}%` }}
              transition={{ duration: 0.8 }}
            />
          </div>
        </div>

        {/* Producers / Consumers counts */}
        <div className="grid grid-cols-2 gap-2 mb-2.5">
          <div className="rounded-lg px-2 py-1.5 text-center" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
            <div className="text-[10px] font-semibold" style={{ color: '#10b981' }}>
              {app.producers.length}
            </div>
            <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Producers</div>
          </div>
          <div className="rounded-lg px-2 py-1.5 text-center" style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.15)' }}>
            <div className="text-[10px] font-semibold" style={{ color: '#22d3ee' }}>
              {app.consumers.length}
            </div>
            <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Consumers</div>
          </div>
        </div>

        {/* Producer list */}
        <div className="space-y-1">
          {app.producers.map(svc => (
            <div key={svc.id} className="flex items-center gap-1.5 text-[10px]">
              <Cpu className="w-2.5 h-2.5 shrink-0" style={{ color: '#10b981' }} />
              <span className="truncate" style={{ color: 'var(--text-secondary)' }}>{svc.name}</span>
              <span className="ml-auto font-mono" style={{ color: '#22d3ee' }}>{svc.tps.toLocaleString()}</span>
            </div>
          ))}
          {app.consumers.map(svc => (
            <div key={svc.id} className="flex items-center gap-1.5 text-[10px]">
              <Box className="w-2.5 h-2.5 shrink-0" style={{ color: '#818cf8' }} />
              <span className="truncate" style={{ color: 'var(--text-secondary)' }}>{svc.name}</span>
              <span className="ml-auto font-mono" style={{ color: '#818cf8' }}>{svc.tps.toLocaleString()}</span>
            </div>
          ))}
        </div>

        {/* QM info */}
        {flow && (
          <div className="mt-2.5 pt-2 border-t flex items-center justify-between" style={{ borderColor: 'var(--surface-border)' }}>
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              <span className="font-medium" style={{ color: '#22d3ee' }}>{flow.sourceQM}</span>
              <span className="mx-1">→</span>
              <span className="font-medium" style={{ color: '#a78bfa' }}>{flow.targetQM}</span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Right Panel — Metadata section ────────────────────────────────────────────

function MetaRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
      <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-[11px] font-semibold" style={{ color: color ?? 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

function ValidationStatusRow({ label, status }: { label: string; status: 'passed' | 'pending' | 'warning' | 'failed' }) {
  const colors: Record<string, string> = {
    passed: '#22c55e', pending: '#6b7280', warning: '#f59e0b', failed: '#ef4444',
  };
  const icons: Record<string, JSX.Element> = {
    passed:  <CheckCircle2 className="w-3 h-3" />,
    pending: <Circle className="w-3 h-3" />,
    warning: <AlertTriangle className="w-3 h-3" />,
    failed:  <AlertTriangle className="w-3 h-3" />,
  };
  return (
    <div className="flex items-center justify-between py-1 text-[11px]">
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <div className="flex items-center gap-1" style={{ color: colors[status] }}>
        {icons[status]}
        <span className="capitalize font-medium">{status}</span>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MigrationWorkspace() {
  const { selectedAppId, selectApp, runtimeLogs } = useWorkspaceStore();
  const selectedApp = MOCK_APPLICATIONS.find(a => a.id === selectedAppId) ?? null;
  const flow = selectedApp ? MOCK_FLOWS.find(f => f.appId === selectedApp.id) : MOCK_FLOWS[0];
  const logEndRef = useRef<HTMLDivElement>(null);
  const [logTick, setLogTick] = useState(0);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [runtimeLogs]);

  // Simulate live log additions
  useEffect(() => {
    const messages = [
      { level: 'INFO' as const, service: 'PAY.QM1', message: 'Health check: OK — 14 queues active' },
      { level: 'INFO' as const, service: 'PaymentAPI', message: `Message batch dispatched (${Math.floor(Math.random() * 200 + 50)} msgs)` },
      { level: 'SUCCESS' as const, service: 'LedgerService', message: 'Consumed 48 messages from PAY.EVENT.IN' },
    ];
    const id = setInterval(() => {
      setLogTick(t => t + 1);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col h-full -m-6 overflow-hidden" style={{ background: 'var(--surface-base)' }}>
      {/* ── Top Header ─────────────────────────────────────────────────────── */}
      <MigrationHeader />

      {/* ── 3-Column Main Area ─────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ── LEFT PANEL ────────────────────────────────────────────────────── */}
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="w-72 shrink-0 flex flex-col border-r overflow-hidden"
          style={{ background: 'var(--surface-raised)', borderColor: 'var(--surface-border)' }}
        >
          {/* Left panel header */}
          <div className="px-4 py-3 border-b flex items-center justify-between shrink-0"
            style={{ borderColor: 'var(--surface-border)' }}>
            <div className="flex items-center gap-2">
              <Server className="w-3.5 h-3.5" style={{ color: '#22d3ee' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Applications</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(6,182,212,0.1)', color: '#22d3ee', border: '1px solid rgba(6,182,212,0.2)' }}>
              <div className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
              {MOCK_APPLICATIONS.filter(a => a.status === 'healthy').length}/{MOCK_APPLICATIONS.length} Healthy
            </div>
          </div>

          {/* Producers section */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <div>
              <div className="flex items-center gap-1.5 mb-2 px-1">
                <Cpu className="w-3 h-3" style={{ color: '#10b981' }} />
                <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#10b981' }}>
                  Producer Apps
                </span>
              </div>
              <div className="space-y-2">
                {MOCK_APPLICATIONS.filter(a => a.producers.length > 0).map(app => (
                  <AppCard
                    key={app.id}
                    app={app}
                    selected={selectedAppId === app.id}
                    onSelect={() => selectApp(selectedAppId === app.id ? null : app.id)}
                  />
                ))}
              </div>
            </div>

            {/* Consumer section — subset view */}
            <div>
              <div className="flex items-center gap-1.5 mb-2 px-1">
                <Box className="w-3 h-3" style={{ color: '#818cf8' }} />
                <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#818cf8' }}>
                  Consumer Services
                </span>
              </div>
              <div className="space-y-1.5">
                {MOCK_APPLICATIONS.flatMap(a => a.consumers).map(svc => (
                  <div key={svc.id}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg border text-[11px]"
                    style={{ background: 'var(--surface-card)', borderColor: 'var(--surface-border)' }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusColor(svc.status) }} />
                    <span className="flex-1 truncate font-medium" style={{ color: 'var(--text-secondary)' }}>{svc.name}</span>
                    <span className="font-mono text-[10px]" style={{ color: '#818cf8' }}>{svc.tps.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.aside>

        {/* ── CENTER PANEL ──────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Canvas toolbar */}
          <div className="px-4 py-2.5 border-b flex items-center justify-between shrink-0"
            style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-raised)' }}>
            <div className="flex items-center gap-3">
              <GitBranch className="w-3.5 h-3.5" style={{ color: '#22d3ee' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Source MQ Topology</span>
              <motion.div
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] border"
                style={{ background: 'rgba(6,182,212,0.08)', borderColor: 'rgba(6,182,212,0.25)', color: '#22d3ee' }}
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                Live
              </motion.div>
              {selectedApp && (
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-md"
                  style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)' }}
                >
                  <span>{selectedApp.name}</span>
                  <ChevronRight className="w-3 h-3 opacity-50" />
                  <span style={{ color: '#22d3ee' }}>{flow?.sourceQM}</span>
                </motion.div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <select
                className="text-[11px] py-0.5 px-2 rounded-md border"
                style={{
                  background: 'var(--surface-card)',
                  borderColor: 'var(--surface-border)',
                  color: 'var(--text-secondary)',
                }}
              >
                <option>Logical Flow</option>
                <option>Physical</option>
                <option>Network</option>
              </select>
              <button className="p-1.5 rounded-md border hover:bg-white/5 transition-colors"
                style={{ borderColor: 'var(--surface-border)', color: 'var(--text-muted)' }}>
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* React Flow Canvas */}
          <div className="flex-1 min-h-0 relative overflow-hidden">
            <AnimatePresence mode="wait">
              {selectedAppId ? (
                <motion.div
                  key={selectedAppId}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="absolute inset-0"
                >
                  <MigrationFlowCanvas />
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-4"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <motion.div
                    animate={{ scale: [1, 1.04, 1] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    className="w-16 h-16 rounded-2xl flex items-center justify-center border"
                    style={{ background: 'rgba(6,182,212,0.05)', borderColor: 'rgba(6,182,212,0.15)' }}
                  >
                    <GitBranch className="w-7 h-7" style={{ color: 'rgba(34,211,238,0.4)' }} />
                  </motion.div>
                  <div className="text-center">
                    <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                      Select an application
                    </div>
                    <div className="text-xs">Click an app in the left panel to view its MQ topology</div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── BOTTOM PANEL — Live Flow / Runtime Logs ──────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="h-44 shrink-0 border-t flex flex-col"
            style={{ borderColor: 'var(--surface-border)', background: 'rgba(8,12,22,0.98)' }}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b shrink-0"
              style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <div className="flex items-center gap-2">
                <Activity className="w-3 h-3" style={{ color: '#22c55e' }} />
                <span className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Live Flow Response
                </span>
                <motion.div
                  className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <div className="w-1 h-1 rounded-full bg-green-400" />
                  Streaming
                </motion.div>
              </div>
              <button className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md border hover:bg-white/5 transition-colors"
                style={{ borderColor: 'var(--surface-border)', color: 'var(--text-muted)' }}>
                <Download className="w-2.5 h-2.5" />
                Export
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[10px] space-y-0.5">
              {[...runtimeLogs].slice(-30).map((log, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-start gap-2 py-0.5 hover:bg-white/[0.02] rounded px-1 transition-colors"
                >
                  <span style={{ color: 'var(--text-muted)', minWidth: 72 }}>{formatTs(log.timestamp)}</span>
                  <span
                    className="font-bold min-w-[52px]"
                    style={{ color: logLevelColor(log.level) }}
                  >
                    {log.level}
                  </span>
                  <span className="min-w-[110px]" style={{ color: '#818cf8' }}>{log.service}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{log.message}</span>
                </motion.div>
              ))}
              <div ref={logEndRef} />
            </div>
          </motion.div>
        </div>

        {/* ── RIGHT PANEL ───────────────────────────────────────────────────── */}
        <motion.aside
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="w-64 shrink-0 flex flex-col border-l overflow-y-auto"
          style={{ background: 'var(--surface-raised)', borderColor: 'var(--surface-border)' }}
        >
          {/* Flow Metadata */}
          <div className="px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--surface-border)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-3.5 h-3.5" style={{ color: '#22d3ee' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Flow Metadata</span>
            </div>
            <MetaRow label="Flow Name"   value={flow?.name ?? '—'} />
            <MetaRow label="Flow ID"     value={flow?.id?.slice(0, 12) ?? '—'} color="#818cf8" />
            <MetaRow label="Source QM"   value={flow?.sourceQM ?? '—'} color="#22d3ee" />
            <MetaRow label="Target QM"   value={flow?.targetQM ?? '—'} color="#a78bfa" />
            <MetaRow
              label="Active Path"
              value={(flow?.activePath ?? 'source').toUpperCase()}
              color={flow?.activePath === 'source' ? '#22d3ee' : '#a78bfa'}
            />
            <MetaRow
              label="Status"
              value={flow?.status ?? 'idle'}
              color={flow?.status === 'migrating' ? '#f59e0b' : flow?.status === 'migrated' ? '#22c55e' : '#6b7280'}
            />
          </div>

          {/* Migration Status */}
          <div className="px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--surface-border)' }}>
            <div className="flex items-center gap-2 mb-2.5">
              <Shield className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Validation Status</span>
            </div>
            <div className="space-y-0.5">
              <ValidationStatusRow label="QM Reachability"  status="passed" />
              <ValidationStatusRow label="TLS Handshake"    status="passed" />
              <ValidationStatusRow label="Auth / CCDT"      status="passed" />
              <ValidationStatusRow label="Queue Definitions" status="passed" />
              <ValidationStatusRow label="DLQ Policy"       status="warning" />
              <ValidationStatusRow label="Message Roundtrip" status="passed" />
            </div>
          </div>

          {/* Live Traffic Metrics */}
          <div className="px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--surface-border)' }}>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-3.5 h-3.5" style={{ color: '#22d3ee' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Live Metrics</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {MOCK_LIVE_METRICS.map((m, i) => {
                const accentMap: Record<string, string> = { cyan: '#22d3ee', green: '#22c55e', amber: '#f59e0b', red: '#ef4444' };
                const accent = accentMap[m.color ?? 'cyan'];
                return (
                  <motion.div
                    key={m.label}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-lg p-2 border"
                    style={{
                      background: `rgba(${m.color === 'cyan' ? '6,182,212' : m.color === 'green' ? '34,197,94' : '245,158,11'},0.05)`,
                      borderColor: `rgba(${m.color === 'cyan' ? '6,182,212' : m.color === 'green' ? '34,197,94' : '245,158,11'},0.15)`,
                    }}
                  >
                    <div className="text-[9px] mb-1" style={{ color: 'var(--text-muted)' }}>{m.label}</div>
                    <div className="font-bold text-sm leading-none" style={{ color: accent }}>
                      {typeof m.value === 'number' ? m.value.toLocaleString() : m.value}
                      {m.unit && <span className="text-[9px] font-normal ml-0.5 opacity-70">{m.unit}</span>}
                    </div>
                    {m.trendValue && (
                      <div className={`flex items-center gap-0.5 text-[9px] mt-1 ${m.trend === 'up' ? 'text-green-400' : m.trend === 'down' ? 'text-cyan-400' : 'text-gray-500'}`}>
                        {m.trend === 'up' ? <TrendingUp className="w-2.5 h-2.5" /> : m.trend === 'down' ? <TrendingDown className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
                        {m.trendValue}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Quick Actions</span>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Validate Source',   icon: <Shield className="w-3 h-3" />,     color: '#22d3ee' },
                { label: 'View Target Topo',  icon: <GitBranch className="w-3 h-3" />,  color: '#a78bfa' },
                { label: 'Export Flow',       icon: <Download className="w-3 h-3" />,   color: '#6b7280' },
                { label: 'Run Probe',         icon: <Activity className="w-3 h-3" />,   color: '#22c55e' },
              ].map(action => (
                <button
                  key={action.label}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px] font-medium transition-all duration-150 hover:bg-white/5"
                  style={{
                    borderColor: 'var(--surface-border)',
                    color: action.color,
                    background: 'transparent',
                  }}
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </motion.aside>
      </div>

      {/* ── BOTTOM SUMMARY BAR ────────────────────────────────────────────── */}
      <div
        className="shrink-0 px-6 py-3 border-t flex items-center justify-between"
        style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-raised)' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Migration Summary</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {selectedApp?.name ?? 'No app selected'}
          </span>
        </div>
        <div className="flex items-center gap-8 text-xs">
          {[
            { label: 'Applications',      value: `${MOCK_APPLICATIONS.length} apps`, color: 'var(--text-primary)' },
            { label: 'Producers',         value: `${MOCK_APPLICATIONS.reduce((s, a) => s + a.producers.length, 0)} services`, color: '#10b981' },
            { label: 'Consumers',         value: `${MOCK_APPLICATIONS.reduce((s, a) => s + a.consumers.length, 0)} services`, color: '#22d3ee' },
            { label: 'Source Topology',   value: flow?.sourceQM ?? '—', color: '#22d3ee' },
            { label: 'Target Topology',   value: flow?.targetQM ?? '—', color: '#a78bfa' },
            { label: 'Est. Downtime',     value: '~15 sec', color: 'var(--text-primary)' },
            { label: 'Strategy',          value: 'Blue/Green', color: 'var(--text-primary)' },
          ].map(item => (
            <div key={item.label}>
              <div className="mb-0.5" style={{ color: 'var(--text-muted)' }}>{item.label}</div>
              <div className="font-semibold" style={{ color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all hover:bg-white/5"
            style={{ borderColor: 'rgba(34,211,238,0.3)', color: '#22d3ee' }}
          >
            <Shield className="w-3 h-3" />
            Validate Source
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, #0e7490, #0891b2)', color: '#fff' }}
          >
            <Play className="w-3 h-3" />
            Start Migration
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
