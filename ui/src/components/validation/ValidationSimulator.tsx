import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, CircleCheck as CheckCircle2, Circle as XCircle, Send, Inbox, TriangleAlert as AlertTriangle } from 'lucide-react';
import { runValidationSimulation } from '../../api/validation';
import type { ValidationSimResult } from '../../types';

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number | null;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 flex-1 bg-slate-50 rounded-xl px-4 py-4 border border-slate-100">
      <div className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${color}`}>
        {icon}
        {label}
      </div>
      <AnimatePresence mode="wait">
        {value !== null ? (
          <motion.span
            key={value}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="text-3xl font-bold text-slate-900 tabular-nums"
          >
            {value}
          </motion.span>
        ) : (
          <span className="text-3xl font-bold text-slate-300">—</span>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ValidationSimulator() {
  const [result, setResult] = useState<ValidationSimResult | null>(null);
  const [running, setRunning] = useState(false);
  const [runCount, setRunCount] = useState(0);

  async function handleRun() {
    setRunning(true);
    try {
      const r = await runValidationSimulation();
      setResult(r);
      setRunCount((c) => c + 1);
    } finally {
      setRunning(false);
    }
  }

  const passed = result?.passed ?? null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Message Flow Simulation</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Sends a random batch (100–200 msgs) and verifies delivery
          </p>
        </div>
        <button
          onClick={handleRun}
          disabled={running}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            running
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-slate-900 text-white hover:bg-slate-700 active:scale-95'
          }`}
        >
          {running ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 rounded-full"
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

      {/* Stats row */}
      <div className="flex gap-3 px-5 py-4">
        <StatCard
          label="Sent"
          value={result?.sent ?? null}
          icon={<Send className="w-3.5 h-3.5" />}
          color="text-slate-500"
        />
        <StatCard
          label="Received"
          value={result?.received ?? null}
          icon={<Inbox className="w-3.5 h-3.5" />}
          color="text-blue-500"
        />
        <StatCard
          label="Errors"
          value={result?.errors ?? null}
          icon={<AlertTriangle className="w-3.5 h-3.5" />}
          color={result && result.errors > 0 ? 'text-red-500' : 'text-slate-400'}
        />
      </div>

      {/* Status badge */}
      <div className="px-5 pb-5">
        <AnimatePresence mode="wait">
          {passed === null ? (
            <div
              key="idle"
              className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 py-4 text-sm text-slate-300"
            >
              Run a simulation to see the result
            </div>
          ) : passed ? (
            <motion.div
              key={`pass-${runCount}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex items-center gap-3 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3"
            >
              <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
              <div>
                <div className="text-sm font-bold text-emerald-700">SUCCESS</div>
                <div className="text-xs text-emerald-600 mt-0.5">
                  All {result!.sent} messages delivered — no errors detected
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={`fail-${runCount}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex items-center gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3"
            >
              <XCircle className="w-6 h-6 text-red-500 shrink-0" />
              <div>
                <div className="text-sm font-bold text-red-700">FAILURE</div>
                <div className="text-xs text-red-600 mt-0.5">
                  {result!.errors} message{result!.errors !== 1 ? 's' : ''} lost — sent {result!.sent}, received {result!.received}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
