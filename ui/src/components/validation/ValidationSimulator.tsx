import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, TriangleAlert as AlertTriangle, Send, Inbox, Zap, CircleCheck as CheckCircle2, Circle as XCircle, Timer } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { runValidationSimulation } from '../../api/validation';
import type { ValidationSimResult, MessageFlowPoint } from '../../types';

interface MetricCardProps {
  label: string;
  value: number | null;
  unit?: string;
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  highlight?: boolean;
}

function MetricCard({ label, value, unit, icon, colorClass, bgClass, borderClass, highlight }: MetricCardProps) {
  return (
    <div
      className={`relative flex flex-col gap-2 rounded-xl border p-4 transition-all duration-300 ${bgClass} ${borderClass} ${
        highlight ? 'shadow-lg' : ''
      }`}
    >
      {highlight && (
        <motion.div
          className="absolute inset-0 rounded-xl"
          animate={{ opacity: [0.15, 0.3, 0.15] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{ background: 'rgba(239,68,68,0.12)', borderRadius: '0.75rem' }}
        />
      )}
      <div className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest ${colorClass}`}>
        {icon}
        {label}
      </div>
      <AnimatePresence mode="wait">
        {value !== null ? (
          <motion.div
            key={value}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="flex items-baseline gap-1.5"
          >
            <span className="text-3xl font-bold text-text-primary tabular-nums">{value}</span>
            {unit && <span className="text-xs text-text-muted">{unit}</span>}
          </motion.div>
        ) : (
          <span className="text-3xl font-bold text-text-muted/30">—</span>
        )}
      </AnimatePresence>
    </div>
  );
}

const CHART_COLORS = {
  sent: '#3b82f6',
  received: '#10b981',
};

function buildInitialHistory(): MessageFlowPoint[] {
  const now = Date.now();
  return Array.from({ length: 10 }, (_, i) => ({
    t: now - (9 - i) * 6000,
    sent: 0,
    received: 0,
  }));
}

export default function ValidationSimulator() {
  const [result, setResult] = useState<ValidationSimResult | null>(null);
  const [running, setRunning] = useState(false);
  const [runCount, setRunCount] = useState(0);
  const [history, setHistory] = useState<MessageFlowPoint[]>(buildInitialHistory);

  const handleRun = useCallback(async () => {
    setRunning(true);
    try {
      const r = await runValidationSimulation();
      setResult(r);
      setRunCount((c) => c + 1);
      setHistory((prev) => {
        const next = [...prev.slice(1), { t: r.timestamp, sent: r.sent, received: r.received }];
        return next;
      });
    } finally {
      setRunning(false);
    }
  }, []);

  const handleSimulateFailure = useCallback(async () => {
    setRunning(true);
    try {
      await new Promise((r) => setTimeout(r, 900));
      const sent = 150 + Math.floor(Math.random() * 50);
      const errors = 8 + Math.floor(Math.random() * 15);
      const received = sent - errors;
      const failResult: ValidationSimResult = {
        sent,
        received,
        errors,
        latency_ms: 420 + Math.floor(Math.random() * 400),
        passed: false,
        timestamp: Date.now(),
      };
      setResult(failResult);
      setRunCount((c) => c + 1);
      setHistory((prev) => {
        const next = [...prev.slice(1), { t: failResult.timestamp, sent: failResult.sent, received: failResult.received }];
        return next;
      });
    } finally {
      setRunning(false);
    }
  }, []);

  const passed = result?.passed ?? null;
  const hasErrors = result !== null && result.errors > 0;

  const chartData = history.map((p, i) => ({
    tick: i + 1,
    Sent: p.sent || null,
    Received: p.received || null,
  }));

  return (
    <div className="flex flex-col gap-4">
      {/* Status banner */}
      <AnimatePresence mode="wait">
        {passed === null ? (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 rounded-xl border border-surface-border bg-surface-card px-5 py-3.5"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-text-muted/30" />
            <span className="text-sm text-text-muted">
              Run a simulation to see validation status
            </span>
          </motion.div>
        ) : passed ? (
          <motion.div
            key={`pass-${runCount}`}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3.5"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-bold text-emerald-300 tracking-wide">SUCCESS</span>
              <span className="text-sm text-emerald-400/70 ml-2">
                All {result!.sent} messages delivered — latency {result!.latency_ms}ms
              </span>
            </div>
            <div className="badge bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">PASS</div>
          </motion.div>
        ) : (
          <motion.div
            key={`fail-${runCount}`}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            className="flex items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-3.5"
          >
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 0.6, repeat: 3 }}
            >
              <XCircle className="w-5 h-5 text-red-400 shrink-0" />
            </motion.div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-bold text-red-300 tracking-wide">FAILURE</span>
              <span className="text-sm text-red-400/70 ml-2">
                {result!.errors} message{result!.errors !== 1 ? 's' : ''} lost — sent {result!.sent}, received {result!.received}
              </span>
            </div>
            <div className="badge bg-red-500/20 text-red-300 border border-red-500/30">FAIL</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main panel */}
      <div className="card overflow-hidden">
        {/* Panel header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Message Flow Simulation</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Sends a random batch (100–200 msgs) and verifies delivery
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSimulateFailure}
              disabled={running}
              className="btn-danger"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Simulate Failure
            </button>
            <button
              onClick={handleRun}
              disabled={running}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                running
                  ? 'bg-surface-overlay text-text-muted cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-500 active:scale-95'
              }`}
            >
              {running ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                    className="w-4 h-4 border-2 border-text-muted/30 border-t-text-muted rounded-full"
                  />
                  Running…
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Simulation
                </>
              )}
            </button>
          </div>
        </div>

        {/* 4 Metric cards */}
        <div className="grid grid-cols-4 gap-3 p-5">
          <MetricCard
            label="Messages Sent"
            value={result?.sent ?? null}
            icon={<Send className="w-3.5 h-3.5" />}
            colorClass="text-blue-400"
            bgClass="bg-blue-500/5"
            borderClass="border-blue-500/20"
          />
          <MetricCard
            label="Messages Received"
            value={result?.received ?? null}
            icon={<Inbox className="w-3.5 h-3.5" />}
            colorClass="text-emerald-400"
            bgClass="bg-emerald-500/5"
            borderClass="border-emerald-500/20"
          />
          <MetricCard
            label="Errors"
            value={result?.errors ?? null}
            icon={<AlertTriangle className="w-3.5 h-3.5" />}
            colorClass={hasErrors ? 'text-red-400' : 'text-text-muted'}
            bgClass={hasErrors ? 'bg-red-500/8' : 'bg-surface-overlay/30'}
            borderClass={hasErrors ? 'border-red-500/30' : 'border-surface-border'}
            highlight={hasErrors}
          />
          <MetricCard
            label="Latency"
            value={result?.latency_ms ?? null}
            unit="ms"
            icon={<Timer className="w-3.5 h-3.5" />}
            colorClass={
              result?.latency_ms != null && result.latency_ms > 200
                ? 'text-amber-400'
                : 'text-sky-400'
            }
            bgClass={
              result?.latency_ms != null && result.latency_ms > 200
                ? 'bg-amber-500/5'
                : 'bg-sky-500/5'
            }
            borderClass={
              result?.latency_ms != null && result.latency_ms > 200
                ? 'border-amber-500/20'
                : 'border-sky-500/20'
            }
          />
        </div>

        {/* Line chart */}
        <div className="px-5 pb-1">
          <div className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-3">
            Message Flow Over Time
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="tick"
                  tick={{ fontSize: 10, fill: '#6B7280' }}
                  tickLine={false}
                  axisLine={false}
                  label={{ value: 'Run', position: 'insideBottomRight', offset: -4, fontSize: 10, fill: '#6B7280' }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#6B7280' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: '#141b2d',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#E5E7EB',
                  }}
                  cursor={{ stroke: 'rgba(255,255,255,0.06)' }}
                />
                <Legend
                  iconType="circle"
                  iconSize={6}
                  wrapperStyle={{ fontSize: '11px', color: '#9CA3AF', paddingTop: '8px' }}
                />
                <Line
                  type="monotone"
                  dataKey="Sent"
                  stroke={CHART_COLORS.sent}
                  strokeWidth={2}
                  dot={{ r: 3, fill: CHART_COLORS.sent }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="Received"
                  stroke={CHART_COLORS.received}
                  strokeWidth={2}
                  dot={{ r: 3, fill: CHART_COLORS.received }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Validation summary card */}
        <div className="px-5 pb-5 pt-4">
          <AnimatePresence mode="wait">
            {passed === null ? (
              <motion.div
                key="idle-summary"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3 rounded-lg border border-dashed border-surface-border px-4 py-3"
              >
                <Zap className="w-4 h-4 text-text-muted/40" />
                <span className="text-sm text-text-muted">
                  Validation summary will appear here after running a simulation
                </span>
              </motion.div>
            ) : passed ? (
              <motion.div
                key={`summary-pass-${runCount}`}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-3 rounded-lg bg-emerald-500/8 border border-emerald-500/20 px-4 py-3"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-sm font-semibold text-emerald-300">
                    No message loss detected
                  </span>
                  <span className="text-xs text-emerald-400/60 ml-2">
                    {result!.sent} sent, {result!.received} received, avg latency {result!.latency_ms}ms
                  </span>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={`summary-fail-${runCount}`}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-3 rounded-lg bg-red-500/8 border border-red-500/25 px-4 py-3"
              >
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <div>
                  <span className="text-sm font-semibold text-red-300">
                    Message loss detected
                  </span>
                  <span className="text-xs text-red-400/60 ml-2">
                    {result!.errors} message{result!.errors !== 1 ? 's' : ''} undelivered — investigate DLQ
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
