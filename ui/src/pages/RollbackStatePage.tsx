import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TriangleAlert as AlertTriangle, RotateCcw, Route, Network, Workflow, Bot, ChevronDown, X, Check, Loader as Loader2, ShieldCheck, RefreshCw } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

type RbStatus = 'pending' | 'running' | 'done';

interface RbStep {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  status: RbStatus;
  logs: string[];
  qm: string;
}

interface AgentMsg {
  id: number;
  text: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const ROLLBACK_STEPS_INIT: Omit<RbStep, 'status' | 'logs'>[] = [
  {
    id: 'revert-routing',
    label: 'Reverting Routing',
    description: 'Deactivate transmission queues and flip routing table back to source. Drain in-flight messages.',
    icon: Route,
    qm: 'QM.APP.A → QM.SRC.A',
  },
  {
    id: 'restore-topology',
    label: 'Restoring Topology',
    description: 'Remove remote queue aliases and restore original local queue definitions on QM.SRC.A.',
    icon: Network,
    qm: 'QM.SRC.A',
  },
  {
    id: 'restart-flows',
    label: 'Restarting Flows',
    description: 'Re-establish source channel pairs, confirm message flow end-to-end, validate DLQ health.',
    icon: Workflow,
    qm: 'QM.SRC.A',
  },
];

const STEP_LOGS: Record<string, string[]> = {
  'revert-routing': [
    'Detecting active transmission queue XMIT.APP.A…',
    'Suspending outbound traffic on QM.APP.A…',
    'In-flight message count: 0 — safe to revert',
    'Flipping route table: QM.APP.A → QM.SRC.A',
    'Routing table restored',
    'Traffic reverting to source…',
  ],
  'restore-topology': [
    'Loading topology snapshot from 14:32:07…',
    'Removing remote queue alias ORDERS.LOCAL',
    'Removing remote queue alias NOTIFY.LOCAL',
    'Restoring local queue ORDERS.LOCAL',
    'Restoring local queue NOTIFY.LOCAL',
    'Source topology restored — 12 queues verified',
  ],
  'restart-flows': [
    'Re-establishing channel CHNL.SRC.APP…',
    'Channel status: RUNNING',
    'Sending 50 validation probes…',
    'Received: 50/50 — latency p99: 5ms',
    'DLQ health: EMPTY',
    'Source flow confirmed operational',
  ],
};

const AGENT_MSGS: Record<string, string> = {
  start: 'Rollback initiated for safety. Validation failed — I am now unwinding all migration changes in reverse order.',
  'revert-routing': 'Reverting routing — draining in-flight messages before flipping the route table.',
  'restore-topology': 'Restoring original topology from pre-migration snapshot captured at 14:32:07.',
  'restart-flows': 'Restarting source flows — confirming zero message loss and DLQ health before signalling recovery.',
  complete: 'Rollback complete. APP.ORDER.SVC is restored to QM.SRC.A with no data loss. System is safe.',
};

// ── Phase colours: Amber → Red → Green ───────────────────────────────────────

function phaseColors(stepIdx: number, totalDone: number, isComplete: boolean) {
  if (isComplete) {
    return {
      dot: '#22C55E',
      glow: 'rgba(34,197,94,0.5)',
      text: '#34D399',
      badgeBg: 'rgba(34,197,94,0.12)',
      badgeBorder: 'rgba(34,197,94,0.3)',
      connectorFrom: '#22C55E',
    };
  }
  if (stepIdx === 0) {
    return {
      dot: '#F59E0B',
      glow: 'rgba(245,158,11,0.5)',
      text: '#FCD34D',
      badgeBg: 'rgba(245,158,11,0.12)',
      badgeBorder: 'rgba(245,158,11,0.35)',
      connectorFrom: '#F59E0B',
    };
  }
  if (stepIdx === 1) {
    return {
      dot: '#EF4444',
      glow: 'rgba(239,68,68,0.5)',
      text: '#FCA5A5',
      badgeBg: 'rgba(239,68,68,0.12)',
      badgeBorder: 'rgba(239,68,68,0.3)',
      connectorFrom: '#EF4444',
    };
  }
  return {
    dot: '#22C55E',
    glow: 'rgba(34,197,94,0.5)',
    text: '#34D399',
    badgeBg: 'rgba(34,197,94,0.12)',
    badgeBorder: 'rgba(34,197,94,0.3)',
    connectorFrom: '#22C55E',
  };
}

// ── Typing text ──────────────────────────────────────────────────────────────

function TypingText({ text, speed = 16 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const idx = useRef(0);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    idx.current = 0;
    const iv = setInterval(() => {
      if (idx.current < text.length) {
        setDisplayed(text.slice(0, idx.current + 1));
        idx.current++;
      } else {
        clearInterval(iv);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(iv);
  }, [text, speed]);

  return (
    <span>
      {displayed}
      {!done && (
        <span
          className="inline-block w-0.5 h-3 ml-0.5 align-middle animate-pulse"
          style={{ background: 'currentColor' }}
        />
      )}
    </span>
  );
}

// ── Warning banner ───────────────────────────────────────────────────────────

function WarningBanner({ isComplete }: { isComplete: boolean }) {
  return (
    <AnimatePresence mode="wait">
      {!isComplete ? (
        <motion.div
          key="warning"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-3 px-5 py-3.5 rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, rgba(220,38,38,0.18) 0%, rgba(245,158,11,0.12) 100%)',
            border: '1px solid rgba(239,68,68,0.4)',
            boxShadow: '0 0 0 1px rgba(239,68,68,0.1), 0 4px 24px rgba(220,38,38,0.18)',
          }}
        >
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [1, 0.6, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'rgba(239,68,68,0.2)',
              border: '1px solid rgba(239,68,68,0.4)',
            }}
          >
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </motion.div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-red-300 tracking-tight leading-none">
              Validation Failed — Rolling Back
            </div>
            <div className="text-xs text-red-400/70 mt-1 leading-relaxed">
              Post-rewire validation did not meet thresholds. Unwinding migration changes automatically.
            </div>
          </div>
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg shrink-0"
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.25)',
            }}
          >
            <motion.span
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
              className="w-1.5 h-1.5 rounded-full bg-red-400"
            />
            <span className="text-[11px] font-semibold text-red-400 uppercase tracking-wider">Rolling Back</span>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="recovery"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-3 px-5 py-3.5 rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(16,185,129,0.08) 100%)',
            border: '1px solid rgba(34,197,94,0.35)',
            boxShadow: '0 0 0 1px rgba(34,197,94,0.08), 0 4px 24px rgba(34,197,94,0.12)',
          }}
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'rgba(34,197,94,0.2)',
              border: '1px solid rgba(34,197,94,0.4)',
            }}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-emerald-300 tracking-tight leading-none">
              System Recovered — Rollback Complete
            </div>
            <div className="text-xs text-emerald-400/70 mt-1">
              APP.ORDER.SVC is restored to QM.SRC.A. Zero message loss confirmed.
            </div>
          </div>
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg shrink-0"
            style={{
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.25)',
            }}
          >
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Restored</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Progress bar ─────────────────────────────────────────────────────────────

function RollbackProgressBar({
  progress,
  isComplete,
  isRunning,
}: {
  progress: number;
  isComplete: boolean;
  isRunning: boolean;
}) {
  const gradient = isComplete
    ? 'linear-gradient(90deg, #16A34A, #22C55E, #34D399)'
    : progress < 40
    ? 'linear-gradient(90deg, #D97706, #F59E0B, #FCD34D)'
    : progress < 80
    ? 'linear-gradient(90deg, #DC2626, #EF4444, #F87171)'
    : 'linear-gradient(90deg, #EF4444, #22C55E)';

  const glowColor = isComplete
    ? 'rgba(34,197,94,0.5)'
    : progress < 40
    ? 'rgba(245,158,11,0.5)'
    : 'rgba(239,68,68,0.5)';

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs">
          {isRunning && !isComplete && (
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            </motion.div>
          )}
          {isComplete && <Check className="w-3.5 h-3.5 text-emerald-400" />}
          {!isRunning && !isComplete && <RotateCcw className="w-3.5 h-3.5 text-slate-500" />}
          <span
            className="font-medium"
            style={{
              color: isComplete ? '#34D399' : isRunning ? '#FCD34D' : 'rgba(255,255,255,0.4)',
            }}
          >
            {isComplete ? 'Recovery complete' : isRunning ? 'Rollback in progress…' : 'Ready to roll back'}
          </span>
        </div>
        <span className="text-xs tabular-nums" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {Math.round(progress)}%
        </span>
      </div>
      <div
        className="w-full h-2 rounded-full overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.05)' }}
      >
        <motion.div
          className="h-full rounded-full relative"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{
            background: gradient,
            boxShadow: isRunning ? `0 0 10px ${glowColor}` : 'none',
          }}
        >
          {isRunning && !isComplete && (
            <motion.div
              className="absolute inset-y-0 w-20 rounded-full"
              animate={{ x: ['-100%', '400%'] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
              }}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}

// ── Rollback step row ─────────────────────────────────────────────────────────

function RbStepRow({
  step,
  stepIdx,
  isLast,
  isComplete,
}: {
  step: RbStep;
  stepIdx: number;
  isLast: boolean;
  isComplete: boolean;
}) {
  const isDone = step.status === 'done';
  const isRunning = step.status === 'running';
  const isPending = step.status === 'pending';
  const colors = phaseColors(stepIdx, 0, isComplete && isDone);

  const Icon = step.icon;

  return (
    <motion.li
      layout
      className={`flex gap-4 ${isLast ? '' : 'pb-6'}`}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: isPending ? 0.35 : 1, x: 0 }}
      transition={{ duration: 0.4, delay: stepIdx * 0.08 }}
    >
      {/* Left: indicator + connector */}
      <div className="flex flex-col items-center shrink-0" style={{ width: 48 }}>
        <motion.div
          className="w-12 h-12 rounded-2xl flex items-center justify-center relative shrink-0"
          animate={
            isRunning
              ? {
                  boxShadow: [
                    `0 0 0px ${colors.glow.replace('0.5', '0')}`,
                    `0 0 24px ${colors.glow}`,
                    `0 0 0px ${colors.glow.replace('0.5', '0')}`,
                  ],
                }
              : {}
          }
          transition={isRunning ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : {}}
          style={{
            background: isDone
              ? `linear-gradient(135deg, ${colors.badgeBg} 0%, rgba(255,255,255,0.02) 100%)`
              : isRunning
              ? `linear-gradient(135deg, ${colors.badgeBg} 0%, rgba(255,255,255,0.02) 100%)`
              : 'rgba(255,255,255,0.03)',
            border: isDone
              ? `1px solid ${colors.badgeBorder}`
              : isRunning
              ? `1px solid ${colors.badgeBorder}`
              : '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <AnimatePresence mode="wait">
            {isDone && (
              <motion.span
                key="done"
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              >
                <Check className="w-5 h-5" style={{ color: colors.dot }} />
              </motion.span>
            )}
            {isRunning && (
              <motion.span key="running" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                >
                  <RotateCcw className="w-5 h-5" style={{ color: colors.dot }} />
                </motion.div>
              </motion.span>
            )}
            {isPending && (
              <motion.span key="pending" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Icon className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.2)' }} />
              </motion.span>
            )}
          </AnimatePresence>

          {/* Reverse-direction step number badge */}
          <span
            className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full text-[9px] font-bold flex items-center justify-center"
            style={{
              width: 18,
              height: 18,
              background: isDone || isRunning ? colors.dot : 'rgba(255,255,255,0.07)',
              color: isDone || isRunning ? '#fff' : 'rgba(255,255,255,0.25)',
              border: isDone || isRunning ? `1px solid ${colors.badgeBorder}` : '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {stepIdx + 1}
          </span>
        </motion.div>

        {/* Connector — animates in reverse (top-to-bottom unfill then refill) */}
        {!isLast && (
          <div
            className="w-px flex-1 mt-1 min-h-[24px] relative overflow-hidden rounded-full"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            <motion.div
              className="absolute inset-x-0 top-0 rounded-full"
              initial={{ height: '0%' }}
              animate={{ height: isDone ? '100%' : '0%' }}
              transition={{ duration: 0.7, ease: 'easeInOut' }}
              style={{
                background: `linear-gradient(180deg, ${colors.dot} 0%, ${colors.dot.replace(')', ', 0.2)')} 100%)`,
              }}
            />
          </div>
        )}
      </div>

      {/* Right: content */}
      <motion.div
        className="flex-1 min-w-0 pt-2"
        animate={{ opacity: isPending ? 0.35 : 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <h3
              className="text-sm font-semibold transition-colors duration-300"
              style={{
                color: isDone
                  ? colors.text
                  : isRunning
                  ? colors.text
                  : 'rgba(255,255,255,0.3)',
              }}
            >
              {step.label}
            </h3>
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                color: 'rgba(255,255,255,0.3)',
              }}
            >
              {step.qm}
            </span>
          </div>

          <AnimatePresence mode="wait">
            {isDone && (
              <motion.span
                key="done-badge"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: colors.badgeBg,
                  border: `1px solid ${colors.badgeBorder}`,
                  color: colors.text,
                }}
              >
                reverted
              </motion.span>
            )}
            {isRunning && (
              <motion.span
                key="running-badge"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: colors.badgeBg,
                  border: `1px solid ${colors.badgeBorder}`,
                  color: colors.text,
                }}
              >
                in progress
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <p className="text-xs mt-1 leading-relaxed pr-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {step.description}
        </p>

        {/* Inline running logs */}
        <AnimatePresence>
          {isRunning && step.logs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-3 overflow-hidden"
            >
              <div
                className="rounded-xl px-3 py-2.5 font-mono text-[11px] space-y-1"
                style={{
                  background: `${colors.badgeBg}`,
                  border: `1px solid ${colors.badgeBorder}`,
                }}
              >
                {step.logs.slice(-3).map((line, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.15 }}
                    style={{ color: colors.text, opacity: i < step.logs.length - 1 ? 0.65 : 1 }}
                  >
                    {i === Math.min(step.logs.length, 3) - 1 ? (
                      <TypingText text={`› ${line}`} speed={12} />
                    ) : (
                      `› ${line}`
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.li>
  );
}

// ── Agent bubble ──────────────────────────────────────────────────────────────

function RollbackAgentBubble({
  messages,
  open,
  setOpen,
  isComplete,
}: {
  messages: AgentMsg[];
  open: boolean;
  setOpen: (v: boolean) => void;
  isComplete: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const last = messages[messages.length - 1];

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 80);
    }
  }, [open, messages.length]);

  const dotColor = isComplete ? '#22C55E' : '#F59E0B';
  const dotGlow = isComplete ? 'rgba(34,197,94,0.7)' : 'rgba(245,158,11,0.7)';
  const bubbleBorder = isComplete ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)';
  const msgColor = isComplete ? '#34D399' : '#FCD34D';

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      <AnimatePresence>
        {!open && last && (
          <motion.div
            key={last.id}
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            onClick={() => setOpen(true)}
            className="cursor-pointer max-w-[280px] rounded-2xl rounded-br-sm px-3.5 py-2.5"
            style={{
              background: '#141B2D',
              border: `1px solid ${bubbleBorder}`,
              boxShadow: `0 8px 24px rgba(0,0,0,0.45), 0 0 0 1px ${bubbleBorder.replace('0.25', '0.08')}`,
            }}
          >
            <div className="flex items-start gap-2">
              <span
                className="mt-1 w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: dotColor, boxShadow: `0 0 6px ${dotGlow}` }}
              />
              <p className="text-xs leading-relaxed font-medium" style={{ color: msgColor }}>
                <TypingText text={last.text} speed={14} />
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-2xl overflow-hidden flex flex-col"
            style={{
              width: '300px',
              maxHeight: '380px',
              background: '#141B2D',
              border: '1px solid #1E2A3D',
              boxShadow: '0 24px 48px rgba(0,0,0,0.5), 0 8px 16px rgba(0,0,0,0.4)',
            }}
          >
            <div
              className="flex items-center justify-between px-4 py-3 shrink-0"
              style={{ borderBottom: '1px solid #1E2A3D', background: 'rgba(10,14,26,0.5)' }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-xl flex items-center justify-center"
                  style={{
                    background: isComplete
                      ? 'linear-gradient(135deg, rgba(34,197,94,0.2) 0%, rgba(16,185,129,0.1) 100%)'
                      : 'linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(217,119,6,0.1) 100%)',
                    border: `1px solid ${isComplete ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
                  }}
                >
                  <Bot className="w-3.5 h-3.5" style={{ color: isComplete ? '#34D399' : '#FCD34D' }} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white leading-none">Rollback Agent</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: dotColor, boxShadow: `0 0 4px ${dotGlow}` }}
                    />
                    <span className="text-[10px] text-slate-400">
                      {isComplete ? 'Recovery complete' : 'Active'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg transition-colors hover:bg-white/5 text-slate-400 hover:text-white"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
              {messages.map((msg, i) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex gap-2 rounded-lg px-2.5 py-2"
                  style={{
                    background: isComplete
                      ? 'rgba(34,197,94,0.08)'
                      : 'rgba(245,158,11,0.08)',
                  }}
                >
                  <span
                    className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: dotColor, boxShadow: `0 0 4px ${dotGlow.replace('0.7', '0.5')}` }}
                  />
                  <p className="text-xs leading-relaxed" style={{ color: isComplete ? '#34D399' : '#FCD34D' }}>
                    {i === messages.length - 1 ? <TypingText text={msg.text} /> : msg.text}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setOpen(!open)}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className="relative w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{
          background: isComplete
            ? 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)'
            : open
            ? 'linear-gradient(135deg, #B45309 0%, #92400E 100%)'
            : 'linear-gradient(135deg, #D97706 0%, #B45309 100%)',
          boxShadow: isComplete
            ? '0 4px 16px rgba(34,197,94,0.4), 0 2px 4px rgba(0,0,0,0.4)'
            : '0 4px 16px rgba(245,158,11,0.4), 0 2px 4px rgba(0,0,0,0.4)',
          border: `1px solid ${isComplete ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
        }}
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.span key="close" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}>
              <X className="w-5 h-5 text-white" />
            </motion.span>
          ) : (
            <motion.span key="bot" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
              <Bot className="w-5 h-5 text-white" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}

// ── Recovery card ─────────────────────────────────────────────────────────────

function RecoveryCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 280, damping: 24, delay: 0.15 }}
      className="rounded-2xl p-5"
      style={{
        background: 'linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(16,185,129,0.06) 100%)',
        border: '1px solid rgba(34,197,94,0.3)',
        boxShadow: '0 0 0 1px rgba(34,197,94,0.06), 0 8px 24px rgba(34,197,94,0.1)',
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: 'rgba(34,197,94,0.2)',
            border: '1px solid rgba(34,197,94,0.35)',
          }}
        >
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <div className="text-sm font-bold text-emerald-300">Rollback Verified</div>
          <div className="text-xs text-emerald-500 mt-0.5">All systems operational</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Source QM', value: 'QM.SRC.A', status: 'Running' },
          { label: 'Message Loss', value: '0', status: 'Zero loss' },
          { label: 'DLQ Health', value: 'EMPTY', status: 'Healthy' },
        ].map(({ label, value, status }) => (
          <div
            key={label}
            className="rounded-xl px-3 py-2.5 text-center"
            style={{
              background: 'rgba(34,197,94,0.08)',
              border: '1px solid rgba(34,197,94,0.2)',
            }}
          >
            <div className="text-[10px] text-emerald-500 uppercase tracking-wider font-semibold">{label}</div>
            <div className="text-sm font-bold text-emerald-300 mt-1">{value}</div>
            <div className="text-[10px] text-emerald-500/70 mt-0.5">{status}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Snapshot card ─────────────────────────────────────────────────────────────

function SnapshotCard() {
  return (
    <div
      className="rounded-2xl p-4 flex items-start gap-3"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
        style={{
          background: 'rgba(14,165,233,0.12)',
          border: '1px solid rgba(14,165,233,0.2)',
        }}
      >
        <RefreshCw className="w-4 h-4 text-sky-400" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-slate-300">Restoring from snapshot</div>
        <div className="text-[11px] text-slate-500 mt-0.5">Captured 14:32:07 — 12 queues, 3 channels</div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {['ORDERS.LOCAL', 'ORDERS.REPLY', 'ORDERS.DLQ', 'NOTIFY.LOCAL'].map((q) => (
            <span
              key={q}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded"
              style={{
                background: 'rgba(14,165,233,0.08)',
                border: '1px solid rgba(14,165,233,0.15)',
                color: 'rgba(148,163,184,0.8)',
              }}
            >
              {q}
            </span>
          ))}
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              color: 'rgba(148,163,184,0.4)',
            }}
          >
            +8 more
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function buildSteps(): RbStep[] {
  return ROLLBACK_STEPS_INIT.map((s) => ({ ...s, status: 'pending', logs: [] }));
}

let logSeq = 0;
function makeAgentMsg(text: string): AgentMsg {
  return { id: ++logSeq, text };
}

export default function RollbackStatePage() {
  const [steps, setSteps] = useState<RbStep[]>(buildSteps);
  const [running, setRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [agentMsgs, setAgentMsgs] = useState<AgentMsg[]>([]);
  const [agentOpen, setAgentOpen] = useState(false);
  const runningRef = useRef(false);

  const pushAgent = useCallback((text: string) => {
    setAgentMsgs((prev) => [...prev, makeAgentMsg(text)]);
  }, []);

  const reset = useCallback(() => {
    runningRef.current = false;
    setSteps(buildSteps());
    setRunning(false);
    setIsComplete(false);
    setAgentMsgs([]);
    logSeq = 0;
  }, []);

  const runRollback = useCallback(async () => {
    if (running) return;
    reset();
    await new Promise((r) => setTimeout(r, 50));
    setRunning(true);
    runningRef.current = true;
    setAgentOpen(true);

    pushAgent(AGENT_MSGS['start']);

    for (let i = 0; i < ROLLBACK_STEPS_INIT.length; i++) {
      if (!runningRef.current) break;
      const stepId = ROLLBACK_STEPS_INIT[i].id;

      setSteps((prev) =>
        prev.map((s) => (s.id === stepId ? { ...s, status: 'running' } : s))
      );
      pushAgent(AGENT_MSGS[stepId]);

      const stepLogs = STEP_LOGS[stepId] ?? [];
      for (let j = 0; j < stepLogs.length; j++) {
        if (!runningRef.current) break;
        await new Promise((r) => setTimeout(r, 280 + Math.random() * 200));
        setSteps((prev) =>
          prev.map((s) =>
            s.id === stepId ? { ...s, logs: [...s.logs, stepLogs[j]] } : s
          )
        );
      }

      if (!runningRef.current) break;
      await new Promise((r) => setTimeout(r, 220));

      setSteps((prev) =>
        prev.map((s) => (s.id === stepId ? { ...s, status: 'done' } : s))
      );
    }

    if (runningRef.current) {
      setIsComplete(true);
      pushAgent(AGENT_MSGS['complete']);
    }

    setRunning(false);
    runningRef.current = false;
  }, [running, reset, pushAgent]);

  const completedCount = steps.filter((s) => s.status === 'done').length;
  const progress = (completedCount / steps.length) * 100;

  return (
    <div className="flex flex-col gap-5 h-full">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: isComplete
                ? 'linear-gradient(135deg, rgba(34,197,94,0.2) 0%, rgba(16,185,129,0.1) 100%)'
                : 'linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(220,38,38,0.1) 100%)',
              border: `1px solid ${isComplete ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              boxShadow: isComplete
                ? '0 0 16px rgba(34,197,94,0.12)'
                : '0 0 16px rgba(239,68,68,0.12)',
            }}
          >
            <motion.div
              animate={running && !isComplete ? { rotate: -360 } : {}}
              transition={running && !isComplete ? { duration: 2, repeat: Infinity, ease: 'linear' } : {}}
            >
              <RotateCcw
                className="w-4.5 h-4.5"
                style={{ width: 18, height: 18, color: isComplete ? '#34D399' : '#F87171' }}
              />
            </motion.div>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white leading-tight">Rollback State</h1>
            <p className="text-xs text-slate-500 mt-0.5">APP.ORDER.SVC &nbsp;·&nbsp; QM.APP.A → QM.SRC.A</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {running && !isComplete && (
            <div
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: '#F87171',
              }}
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Rolling back…
            </div>
          )}
          {isComplete && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
              style={{
                background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.2)',
                color: '#34D399',
              }}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Recovered
            </motion.div>
          )}
          {(isComplete || (!running && completedCount === 0)) && (
            <motion.button
              onClick={reset}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.6)',
              }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </motion.button>
          )}
          <motion.button
            onClick={runRollback}
            disabled={running}
            whileHover={running ? {} : { scale: 1.03 }}
            whileTap={running ? {} : { scale: 0.97 }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 disabled:opacity-50"
            style={{
              background: running
                ? 'rgba(239,68,68,0.15)'
                : isComplete
                ? 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)'
                : 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
              color: '#fff',
              border: `1px solid ${isComplete ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
              boxShadow: running
                ? 'none'
                : isComplete
                ? '0 4px 16px rgba(34,197,94,0.3)'
                : '0 4px 16px rgba(220,38,38,0.3)',
            }}
          >
            {running ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Rolling back…
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                {isComplete ? 'Re-run Rollback' : 'Initiate Rollback'}
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* Warning / Recovery banner */}
      <WarningBanner isComplete={isComplete} />

      {/* Progress bar */}
      <RollbackProgressBar progress={progress} isComplete={isComplete} isRunning={running} />

      {/* Main layout */}
      <div className="flex gap-5 flex-1 min-h-0 overflow-hidden">
        {/* Reverse timeline */}
        <div
          className="flex-1 rounded-2xl overflow-y-auto min-h-0"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* Timeline header */}
          <div
            className="sticky top-0 flex items-center gap-2.5 px-5 py-3.5 z-10"
            style={{
              background: 'rgba(11,15,26,0.9)',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <motion.div
              animate={running && !isComplete ? { rotate: -360 } : {}}
              transition={running && !isComplete ? { duration: 2.5, repeat: Infinity, ease: 'linear' } : {}}
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            </motion.div>
            <span className="text-xs font-semibold text-slate-300 tracking-wide">Reverse Timeline</span>
            <div className="ml-auto flex items-center gap-3 text-[10px] text-slate-500">
              {[
                { color: '#F59E0B', label: 'Amber' },
                { color: '#EF4444', label: 'Red' },
                { color: '#22C55E', label: 'Green' },
              ].map(({ color, label }) => (
                <span key={label} className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="relative px-5 py-5">
            {/* Vertical guide */}
            <div
              className="absolute top-5 bottom-5 w-px"
              style={{
                left: 44,
                background: 'linear-gradient(180deg, rgba(239,68,68,0.2) 0%, rgba(245,158,11,0.08) 50%, rgba(34,197,94,0.15) 100%)',
              }}
            />
            <ol className="space-y-0 relative">
              {steps.map((step, i) => (
                <RbStepRow
                  key={step.id}
                  step={step}
                  stepIdx={i}
                  isLast={i === steps.length - 1}
                  isComplete={isComplete}
                />
              ))}
            </ol>
          </div>
        </div>

        {/* Right panel */}
        <div className="w-[320px] shrink-0 flex flex-col gap-4 min-h-0 overflow-y-auto">
          {/* Snapshot restore card */}
          <SnapshotCard />

          {/* Phase legend */}
          <div
            className="rounded-2xl p-4"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Recovery Phase
            </div>
            <div className="space-y-2.5">
              {[
                {
                  step: '1',
                  color: '#F59E0B',
                  label: 'Reverting Routing',
                  sub: 'Drain traffic, flip route table',
                  phase: 'Amber',
                },
                {
                  step: '2',
                  color: '#EF4444',
                  label: 'Restoring Topology',
                  sub: 'Remove aliases, restore queues',
                  phase: 'Red',
                },
                {
                  step: '3',
                  color: '#22C55E',
                  label: 'Restarting Flows',
                  sub: 'Re-establish channels, validate',
                  phase: 'Green',
                },
              ].map(({ step, color, label, sub, phase }) => (
                <div key={step} className="flex items-start gap-2.5">
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                    style={{
                      background: `${color}1a`,
                      border: `1px solid ${color}40`,
                      color,
                    }}
                  >
                    {step}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-300 leading-none">{label}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>
                  </div>
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 mt-0.5"
                    style={{
                      background: `${color}15`,
                      border: `1px solid ${color}35`,
                      color,
                    }}
                  >
                    {phase}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Safety indicators */}
          <div
            className="rounded-2xl p-4"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Safety Indicators
            </div>
            <div className="space-y-2">
              {[
                { label: 'Automated rollback', ok: true },
                { label: 'Zero message loss guarantee', ok: true },
                { label: 'Snapshot-based recovery', ok: true },
                { label: 'Manual intervention required', ok: false },
              ].map(({ label, ok }) => (
                <div key={label} className="flex items-center gap-2.5">
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                    style={{
                      background: ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.1)',
                      border: `1px solid ${ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.2)'}`,
                    }}
                  >
                    {ok ? (
                      <Check className="w-2.5 h-2.5 text-emerald-400" />
                    ) : (
                      <X className="w-2.5 h-2.5 text-red-400" />
                    )}
                  </div>
                  <span className="text-xs text-slate-400">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recovery card — shown when complete */}
          <AnimatePresence>
            {isComplete && <RecoveryCard />}
          </AnimatePresence>
        </div>
      </div>

      {/* Agent bubble */}
      <RollbackAgentBubble
        messages={agentMsgs}
        open={agentOpen}
        setOpen={setAgentOpen}
        isComplete={isComplete}
      />
    </div>
  );
}
