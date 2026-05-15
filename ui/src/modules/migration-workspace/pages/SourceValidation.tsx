import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { ArrowRight, Send, History, CircleCheck as CheckCircle2, Circle as XCircle, Zap, Hash, Layers, Activity, Terminal, ChevronRight, RefreshCw, Inbox, Radio } from 'lucide-react';
import MigrationHeader from '../components/MigrationHeader';
import { useWorkspaceStore } from '../store/workspaceStore';
import { format } from 'date-fns';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RequestHistoryEntry {
  id: string;
  timestamp: number;
  payload: string;
  status: 'success' | 'error' | 'pending';
  latency?: number;
  correlationId?: string;
}

interface FlowParticle {
  id: string;
  stage: number;
  progress: number;
  color: string;
}

interface ConsumerResponse {
  ackStatus: 'ACK' | 'NACK' | 'pending';
  latency: number;
  correlationId: string;
  queueDepth: number;
  processingStatus: 'idle' | 'processing' | 'completed' | 'failed';
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STAGE_COLORS = ['#22d3ee', '#3b82f6', '#8b5cf6', '#22c55e'];

const FLOW_NODES = [
  { id: 'producer', label: 'PaymentAPI',   sub: 'Producer',     color: '#22d3ee' },
  { id: 'queue',    label: 'PAY.QM1',      sub: 'Source Queue', color: '#3b82f6' },
  { id: 'channel',  label: 'CHANNEL.PAY',  sub: 'MQ Channel',   color: '#8b5cf6' },
  { id: 'consumer', label: 'LedgerSvc',    sub: 'Consumer',     color: '#22c55e' },
];

const LEVEL_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  INFO:    { color: '#9ca3af', bg: 'transparent',             label: 'INFO' },
  WARNING: { color: '#f59e0b', bg: 'rgba(245,158,11,0.05)',   label: 'WARN' },
  ERROR:   { color: '#ef4444', bg: 'rgba(239,68,68,0.05)',    label: 'ERR ' },
  SUCCESS: { color: '#22c55e', bg: 'rgba(34,197,94,0.05)',    label: 'SUCC' },
};

const DEFAULT_PAYLOAD = `{
  "paymentId": "PAY12345",
  "amount": 500,
  "currency": "USD"
}`;

// ── Topology Flow Canvas ──────────────────────────────────────────────────────

function TopologyFlowCanvas({
  particles,
  activeStage,
}: {
  particles: FlowParticle[];
  activeStage: number;
}) {
  const W = 720;
  const H = 140;
  const NODE_W = 110;
  const NODE_H = 60;
  const NODE_Y = (H - NODE_H) / 2;
  const EDGE_Y = H / 2;
  const nodeXs = [20, 190, 370, 550];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" style={{ minHeight: 120 }}>
      <defs>
        <filter id="p-glow" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Connector lines */}
      {nodeXs.slice(0, -1).map((x, i) => {
        const x1 = x + NODE_W;
        const x2 = nodeXs[i + 1];
        const active = activeStage > i;
        return (
          <g key={`edge-${i}`}>
            <line
              x1={x1} y1={EDGE_Y} x2={x2} y2={EDGE_Y}
              stroke={active ? STAGE_COLORS[i] : '#1E2A3D'}
              strokeWidth={active ? 2 : 1}
              strokeDasharray={active ? 'none' : '4 4'}
              style={{ filter: active ? `drop-shadow(0 0 4px ${STAGE_COLORS[i]}66)` : 'none' }}
            />
            {active && (
              <polygon
                points={`${x2 - 7},${EDGE_Y - 5} ${x2},${EDGE_Y} ${x2 - 7},${EDGE_Y + 5}`}
                fill={STAGE_COLORS[i]}
                style={{ filter: `drop-shadow(0 0 3px ${STAGE_COLORS[i]})` }}
              />
            )}
          </g>
        );
      })}

      {/* Nodes */}
      {FLOW_NODES.map((node, i) => {
        const x = nodeXs[i];
        const isActive = activeStage >= i;
        const isCurrent = activeStage === i;
        return (
          <g key={node.id} transform={`translate(${x},${NODE_Y})`}>
            {isCurrent && (
              <rect x={-3} y={-3} width={NODE_W + 6} height={NODE_H + 6} rx={13}
                fill="none" stroke={node.color} strokeWidth={1.5} strokeOpacity={0.4}
                style={{ filter: `drop-shadow(0 0 8px ${node.color})` }}
              >
                <animate attributeName="strokeOpacity" values="0.4;0.9;0.4" dur="1.4s" repeatCount="indefinite" />
              </rect>
            )}
            <rect x={0} y={0} width={NODE_W} height={NODE_H} rx={11}
              fill={isActive ? `${node.color}18` : 'rgba(14,20,35,0.85)'}
              stroke={isActive ? node.color : '#1E2A3D'}
              strokeWidth={isActive ? 1.5 : 1}
              style={{ filter: isActive ? `drop-shadow(0 0 6px ${node.color}44)` : 'none' }}
            />
            <text x={NODE_W / 2} y={22} textAnchor="middle" fontSize={10} fontWeight={600} fill={isActive ? node.color : '#4B5563'}>
              {node.label}
            </text>
            <text x={NODE_W / 2} y={36} textAnchor="middle" fontSize={8.5} fill={isActive ? '#6B7280' : '#374151'}>
              {node.sub}
            </text>
            {isActive && (
              <circle cx={NODE_W - 10} cy={11} r={3.5} fill={node.color}
                style={{ filter: `drop-shadow(0 0 4px ${node.color})` }}
              >
                <animate attributeName="opacity" values="1;0.35;1" dur="1.1s" repeatCount="indefinite" />
              </circle>
            )}
          </g>
        );
      })}

      {/* Moving particles */}
      {particles.map((p) => {
        const si = Math.min(p.stage, nodeXs.length - 2);
        const x1 = nodeXs[si] + NODE_W;
        const x2 = nodeXs[si + 1];
        const px = x1 + (x2 - x1) * p.progress;
        return (
          <g key={p.id}>
            <circle cx={px} cy={EDGE_Y} r={5} fill={p.color} filter="url(#p-glow)" />
            <circle cx={px} cy={EDGE_Y} r={2.2} fill="white" opacity={0.95} />
          </g>
        );
      })}
    </svg>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'ACK' | 'NACK' | 'pending' }) {
  const map = {
    ACK:     { bg: 'rgba(34,197,94,0.15)',   border: '#22c55e', text: '#22c55e',  label: 'ACK' },
    NACK:    { bg: 'rgba(239,68,68,0.15)',   border: '#ef4444', text: '#ef4444',  label: 'NACK' },
    pending: { bg: 'rgba(100,116,139,0.15)', border: '#64748b', text: '#94a3b8',  label: 'PENDING' },
  };
  const s = map[status];
  return (
    <span className="px-2 py-0.5 rounded text-xs font-bold font-mono"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text }}>
      {s.label}
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SourceValidation() {
  const navigate = useNavigate();
  const { setStep, addRuntimeLog } = useWorkspaceStore();

  const [payload, setPayload] = useState(DEFAULT_PAYLOAD);
  const [isSending, setIsSending] = useState(false);
  const [requestHistory, setRequestHistory] = useState<RequestHistoryEntry[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [particles, setParticles] = useState<FlowParticle[]>([]);
  const [activeStage, setActiveStage] = useState(-1);
  const [consumerResponse, setConsumerResponse] = useState<ConsumerResponse>({
    ackStatus: 'pending',
    latency: 0,
    correlationId: '',
    queueDepth: 0,
    processingStatus: 'idle',
  });
  const [logs, setLogs] = useState<Array<{ id: string; timestamp: number; level: string; service: string; message: string }>>([]);
  const [payloadError, setPayloadError] = useState<string | null>(null);

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
    setLogs(prev => [...prev, entry]);
    addRuntimeLog({ level: level as 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS', service, message });
  }, [addRuntimeLog]);

  const spawnParticle = useCallback((stage: number) => {
    const id = `p-${Date.now()}-${stage}-${Math.random()}`;
    const color = STAGE_COLORS[stage] ?? '#22d3ee';
    setParticles(prev => [...prev, { id, stage, progress: 0, color }]);
    let frame = 0;
    const STEPS = 28;
    const tick = () => {
      frame++;
      const progress = Math.min(frame / STEPS, 1);
      setParticles(prev => prev.map(p => p.id === id ? { ...p, progress } : p));
      if (frame < STEPS) {
        const t = setTimeout(tick, 22);
        timers.current.push(t);
      } else {
        setParticles(prev => prev.filter(p => p.id !== id));
      }
    };
    const t = setTimeout(tick, 22);
    timers.current.push(t);
  }, []);

  const sendMessage = useCallback(() => {
    setPayloadError(null);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(payload);
    } catch {
      setPayloadError('Invalid JSON — please fix before sending');
      return;
    }

    const msgId = (parsed.paymentId as string) ?? `MSG-${Date.now()}`;
    const corrId = `CORR-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    const startMs = Date.now();

    setIsSending(true);
    setActiveStage(0);
    setConsumerResponse({ ackStatus: 'pending', latency: 0, correlationId: corrId, queueDepth: 0, processingStatus: 'idle' });

    const historyId = `req-${Date.now()}`;
    setRequestHistory(prev => [
      { id: historyId, timestamp: startMs, payload, status: 'pending', correlationId: corrId },
      ...prev.slice(0, 9),
    ]);

    schedule(() => { appendLog('INFO', 'PaymentAPI', `Publishing message payload: ${msgId}`); spawnParticle(0); }, 80);
    schedule(() => { setActiveStage(1); appendLog('INFO', 'PAY.QM1', `Enqueued to PAY.EVENT.OUT [corrId=${corrId}]`); setConsumerResponse(p => ({ ...p, queueDepth: 12, processingStatus: 'processing' })); spawnParticle(1); }, 720);
    schedule(() => { setActiveStage(2); appendLog('INFO', 'CHANNEL.PAY', 'Transferring via MQ channel CLOUD.TO.LOCAL'); spawnParticle(2); }, 1440);
    schedule(() => { setActiveStage(3); appendLog('INFO', 'LEDGER.QM2', `Received on PAY.EVENT.IN [corrId=${corrId}]`); appendLog('INFO', 'LedgerService', 'Message consumed — dispatching to handler'); }, 2100);
    schedule(() => { appendLog('INFO', 'LedgerService', `Processing payment transaction: ${msgId}`); }, 2600);
    schedule(() => {
      const latency = Date.now() - startMs;
      appendLog('SUCCESS', 'LedgerService', 'ACK sent — message committed');
      appendLog('SUCCESS', 'Validation', 'End-to-end roundtrip validated ✓');
      setConsumerResponse({ ackStatus: 'ACK', latency, correlationId: corrId, queueDepth: 11, processingStatus: 'completed' });
      setRequestHistory(prev => prev.map(r => r.id === historyId ? { ...r, status: 'success', latency } : r));
      setIsSending(false);
    }, 3200);
  }, [payload, appendLog, spawnParticle, schedule]);

  const proceed = () => {
    setStep('config-redeploy');
    navigate('/migration/config-redeploy');
  };

  return (
    <div className="flex flex-col h-full -m-6 overflow-hidden">
      <MigrationHeader />

      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── LEFT: Swagger-like validation panel ── */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35 }}
          className="w-[350px] shrink-0 border-r border-surface-border flex flex-col overflow-hidden"
          style={{ background: 'var(--surface-raised)' }}
        >
          <div className="px-4 py-2.5 border-b border-surface-border flex items-center gap-2 shrink-0">
            <div className="w-2 h-2 rounded-full bg-cyan-400" style={{ boxShadow: '0 0 6px #22d3ee' }} />
            <span className="text-xs font-semibold text-text-primary">Source Validation</span>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full border border-cyan-400/30 text-cyan-400 font-mono">
              POST /validate
            </span>
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
            {/* JSON Payload Editor */}
            <div className="p-3 border-b border-surface-border shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">Request Body</span>
                <span className="text-[10px] text-text-muted ml-auto font-mono">application/json</span>
              </div>

              <div
                className="rounded-xl overflow-hidden border"
                style={{
                  borderColor: payloadError ? '#ef4444' : 'var(--surface-border)',
                  boxShadow: payloadError ? '0 0 8px rgba(239,68,68,0.2)' : 'none',
                }}
              >
                <Editor
                  height="170px"
                  defaultLanguage="json"
                  value={payload}
                  onChange={(v) => { setPayload(v ?? ''); setPayloadError(null); }}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 12,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    folding: false,
                    renderLineHighlight: 'line',
                    overviewRulerBorder: false,
                    scrollbar: { vertical: 'hidden', horizontal: 'hidden' },
                    padding: { top: 8, bottom: 8 },
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                />
              </div>

              <AnimatePresence>
                {payloadError && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-1.5 flex items-center gap-1.5 text-[11px] text-red-400"
                  >
                    <XCircle className="w-3 h-3 shrink-0" />
                    {payloadError}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                onClick={sendMessage}
                disabled={isSending}
                whileHover={{ scale: isSending ? 1 : 1.02 }}
                whileTap={{ scale: isSending ? 1 : 0.98 }}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: isSending ? 'rgba(34,211,238,0.08)' : 'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)',
                  color: isSending ? '#22d3ee' : '#fff',
                  border: '1px solid rgba(34,211,238,0.3)',
                  boxShadow: isSending ? 'none' : '0 0 14px rgba(34,211,238,0.3)',
                  cursor: isSending ? 'not-allowed' : 'pointer',
                }}
              >
                {isSending ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" />Sending…</>
                ) : (
                  <><Send className="w-4 h-4" />Send Test Message</>
                )}
              </motion.button>
            </div>

            {/* Request History */}
            <div className="p-3 flex-1">
              <div className="flex items-center gap-2 mb-2">
                <History className="w-3.5 h-3.5 text-text-muted" />
                <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">Request History</span>
                <span className="ml-auto text-[10px] text-text-muted">{requestHistory.length} entries</span>
              </div>

              {requestHistory.length === 0 ? (
                <div className="text-center py-5 text-text-muted text-[11px]">No requests yet</div>
              ) : (
                <div className="space-y-1.5">
                  <AnimatePresence>
                    {requestHistory.map((entry) => (
                      <motion.button
                        key={entry.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => { setSelectedHistoryId(entry.id); setPayload(entry.payload); }}
                        className="w-full text-left rounded-lg px-3 py-2 flex items-center gap-2 transition-colors"
                        style={{
                          background: selectedHistoryId === entry.id ? 'var(--surface-overlay)' : 'var(--surface-card)',
                          border: `1px solid ${selectedHistoryId === entry.id ? 'rgba(34,211,238,0.3)' : 'var(--surface-border)'}`,
                        }}
                      >
                        <div className="w-2 h-2 rounded-full shrink-0" style={{
                          background: entry.status === 'success' ? '#22c55e' : entry.status === 'error' ? '#ef4444' : '#f59e0b',
                        }} />
                        <span className="text-[11px] text-text-secondary font-mono flex-1 truncate">
                          {format(entry.timestamp, 'HH:mm:ss')}
                        </span>
                        {entry.latency !== undefined && (
                          <span className="text-[10px] text-text-muted font-mono shrink-0">{entry.latency}ms</span>
                        )}
                        <ChevronRight className="w-3 h-3 text-text-muted shrink-0" />
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>

          <div className="px-4 py-3 border-t border-surface-border flex gap-2 shrink-0">
            <button className="btn-ghost flex-1 text-xs justify-center" onClick={() => navigate('/migration-workspace')}>
              Back
            </button>
            <button className="btn-primary flex-1 text-xs justify-center" onClick={proceed}>
              Proceed to Config
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>

        {/* ── CENTER + RIGHT + BOTTOM wrapper ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          <div className="flex flex-1 min-h-0 overflow-hidden">

            {/* ── CENTER: Live MQ Topology Flow ── */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden border-r border-surface-border">
              <div className="px-4 py-2.5 border-b border-surface-border flex items-center gap-2 shrink-0">
                <Radio className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-semibold text-text-primary">Live MQ Topology Flow</span>
                <AnimatePresence>
                  {isSending && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="ml-auto text-[11px] px-2 py-0.5 rounded-full font-mono"
                      style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.2)' }}
                    >
                      LIVE
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex-1 flex flex-col p-4 overflow-hidden">
                <div
                  className="rounded-2xl p-4 flex-1 flex flex-col justify-center min-h-0"
                  style={{
                    background: 'rgba(0,0,0,0.25)',
                    border: '1px solid var(--surface-border)',
                    boxShadow: activeStage >= 0 ? '0 0 30px rgba(34,211,238,0.05)' : 'none',
                  }}
                >
                  <TopologyFlowCanvas particles={particles} activeStage={activeStage} />

                  {/* Stage progress dots */}
                  <div className="flex justify-around mt-4">
                    {['Payload', 'Queue', 'Channel', 'Consumer'].map((label, i) => (
                      <div key={label} className="flex flex-col items-center gap-1">
                        <motion.span
                          animate={{ opacity: activeStage === i ? 1 : activeStage > i ? 0.6 : 0.3, scale: activeStage === i ? 1.05 : 1 }}
                          className="text-[11px] font-semibold"
                          style={{ color: activeStage >= i ? STAGE_COLORS[i] : '#374151' }}
                        >
                          {label}
                        </motion.span>
                        <div className="w-1.5 h-1.5 rounded-full transition-all" style={{
                          background: activeStage >= i ? STAGE_COLORS[i] : '#1E2A3D',
                          boxShadow: activeStage === i ? `0 0 6px ${STAGE_COLORS[i]}` : 'none',
                        }} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Legend */}
                <div className="mt-3 flex gap-4 flex-wrap shrink-0">
                  {[
                    { color: '#22d3ee', label: 'Payload published' },
                    { color: '#3b82f6', label: 'Queue enqueued' },
                    { color: '#8b5cf6', label: 'Channel transfer' },
                    { color: '#22c55e', label: 'Consumer received' },
                  ].map(({ color, label }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                      <span className="text-[10px] text-text-muted">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── RIGHT: Consumer Response Panel ── */}
            <motion.aside
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35 }}
              className="w-[248px] shrink-0 flex flex-col overflow-hidden"
              style={{ background: 'var(--surface-raised)' }}
            >
              <div className="px-4 py-2.5 border-b border-surface-border flex items-center gap-2 shrink-0">
                <Inbox className="w-3.5 h-3.5 text-green-400" />
                <span className="text-xs font-semibold text-text-primary">Consumer Response</span>
              </div>

              <div className="flex-1 p-3 space-y-2.5 overflow-y-auto">
                {/* ACK Status */}
                <div className="rounded-xl p-3" style={{ background: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-text-muted uppercase tracking-wide font-semibold">ACK Status</span>
                    <StatusBadge status={consumerResponse.ackStatus} />
                  </div>
                  <AnimatePresence>
                    {consumerResponse.ackStatus === 'ACK' && (
                      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-1.5 mt-1">
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                        <span className="text-xs text-green-400 font-semibold">Message acknowledged</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Latency */}
                <div className="rounded-xl p-3" style={{ background: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-3 h-3 text-cyan-400" />
                    <span className="text-[10px] text-text-muted uppercase tracking-wide font-semibold">Latency</span>
                  </div>
                  <div className="flex items-end gap-1">
                    <span className="text-2xl font-bold font-mono tabular-nums" style={{
                      color: consumerResponse.latency > 0 ? '#22d3ee' : '#374151',
                      textShadow: consumerResponse.latency > 0 ? '0 0 12px rgba(34,211,238,0.5)' : 'none',
                    }}>
                      {consumerResponse.latency > 0 ? consumerResponse.latency : '—'}
                    </span>
                    {consumerResponse.latency > 0 && <span className="text-xs text-text-muted mb-1">ms</span>}
                  </div>
                </div>

                {/* Correlation ID */}
                <div className="rounded-xl p-3" style={{ background: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Hash className="w-3 h-3 text-text-muted" />
                    <span className="text-[10px] text-text-muted uppercase tracking-wide font-semibold">Correlation ID</span>
                  </div>
                  <span className="text-[11px] font-mono break-all" style={{ color: consumerResponse.correlationId ? '#a5b4fc' : '#374151' }}>
                    {consumerResponse.correlationId || '—'}
                  </span>
                </div>

                {/* Queue Depth */}
                <div className="rounded-xl p-3" style={{ background: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Layers className="w-3 h-3 text-blue-400" />
                    <span className="text-[10px] text-text-muted uppercase tracking-wide font-semibold">Queue Depth</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl font-bold font-mono tabular-nums" style={{ color: consumerResponse.queueDepth > 0 ? '#3b82f6' : '#374151' }}>
                      {consumerResponse.queueDepth > 0 ? consumerResponse.queueDepth : '—'}
                    </span>
                    {consumerResponse.queueDepth > 0 && <span className="text-[10px] text-text-muted">messages</span>}
                  </div>
                </div>

                {/* Processing Status */}
                <div className="rounded-xl p-3" style={{ background: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="w-3 h-3 text-text-muted" />
                    <span className="text-[10px] text-text-muted uppercase tracking-wide font-semibold">Processing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{
                      background: consumerResponse.processingStatus === 'completed' ? '#22c55e'
                        : consumerResponse.processingStatus === 'processing' ? '#f59e0b'
                        : consumerResponse.processingStatus === 'failed' ? '#ef4444'
                        : '#374151',
                      boxShadow: consumerResponse.processingStatus === 'processing' ? '0 0 6px #f59e0b'
                        : consumerResponse.processingStatus === 'completed' ? '0 0 6px #22c55e'
                        : 'none',
                    }} />
                    <span className="text-sm font-semibold capitalize" style={{
                      color: consumerResponse.processingStatus === 'completed' ? '#22c55e'
                        : consumerResponse.processingStatus === 'processing' ? '#f59e0b'
                        : consumerResponse.processingStatus === 'failed' ? '#ef4444'
                        : '#374151',
                    }}>
                      {consumerResponse.processingStatus}
                    </span>
                  </div>
                </div>

                {/* Roundtrip complete banner */}
                <AnimatePresence>
                  {consumerResponse.ackStatus === 'ACK' && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="rounded-xl p-3 flex items-center gap-2"
                      style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', boxShadow: '0 0 16px rgba(34,197,94,0.1)' }}
                    >
                      <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                      <div>
                        <div className="text-xs font-semibold text-green-400">Roundtrip Complete</div>
                        <div className="text-[10px] text-green-500 mt-0.5">Validated in {consumerResponse.latency}ms</div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.aside>
          </div>

          {/* ── BOTTOM: Runtime Logs Console ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 }}
            className="h-[190px] shrink-0 border-t border-surface-border flex flex-col"
            style={{ background: 'rgba(0,0,0,0.38)' }}
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-border shrink-0">
              <Terminal className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-xs font-semibold text-text-primary">Runtime Logs</span>
              <span className="text-[11px] text-text-muted ml-auto font-mono">{logs.length} entries</span>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[11px] text-green-400">Live</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {logs.length === 0 ? (
                <div className="flex items-center gap-2 px-3 py-2 text-[11px] font-mono">
                  <span className="text-text-muted">$</span>
                  <span className="text-text-muted">Waiting for test messages…</span>
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
                        transition={{ duration: 0.12 }}
                        className="flex items-start gap-2 px-3 py-0.5 text-[11px] leading-relaxed"
                        style={{ background: s.bg }}
                      >
                        <span className="text-text-muted shrink-0 tabular-nums w-14">{format(entry.timestamp, 'HH:mm:ss')}</span>
                        <span className="shrink-0 font-semibold w-8" style={{ color: s.color }}>{s.label}</span>
                        <span className="shrink-0 min-w-[108px] text-[#a5b4fc]">{entry.service}</span>
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
    </div>
  );
}
