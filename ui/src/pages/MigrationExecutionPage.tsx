import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Server, Layers, GitBranch, ArrowRightLeft, Route, ShieldCheck, CircleCheck as CheckCircle2, Loader as Loader2, Circle as XCircle, Clock, Terminal, Bot, X, ChevronDown, Play, RotateCcw, Zap, CircleDot } from 'lucide-react';
import DragMigrationBoard from '../components/migration/DragMigrationBoard';

// ── Types ───────────────────────────────────────────────────────────────────

type StepStatus = 'pending' | 'running' | 'success' | 'failed';

interface ExecStep {
  id: number;
  title: string;
  detail: string;
  icon: React.ElementType;
  qm: string;
  duration: string;
  status: StepStatus;
  logs: string[];
}

interface LogLine {
  id: number;
  ts: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  text: string;
}

interface AgentMsg {
  id: number;
  text: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

const INITIAL_STEPS: Omit<ExecStep, 'status' | 'logs'>[] = [
  {
    id: 1,
    title: 'Baseline Validation',
    detail: 'Snapshot source topology and validate TLS certificates, naming policy, and DLQ presence before execution begins.',
    icon: ShieldCheck,
    qm: 'QM.SRC.A',
    duration: '~18s',
  },
  {
    id: 2,
    title: 'Create QM_APP_A',
    detail: 'Provision a dedicated queue manager on the target cluster. Applies OCP namespace, RBAC roles, and resource quotas.',
    icon: Server,
    qm: 'QM.APP.A',
    duration: '~45s',
  },
  {
    id: 3,
    title: 'Provision Queues',
    detail: 'Define all local queues on QM_APP_A matching source topology. Dead-letter queue (DLQ) is created automatically per policy.',
    icon: Layers,
    qm: 'QM.APP.A',
    duration: '~20s',
  },
  {
    id: 4,
    title: 'Setup Channels',
    detail: 'Establish sender/receiver channel pairs between QM.SRC.A and QM.APP.A. MCA credentials injected from sealed secrets.',
    icon: GitBranch,
    qm: 'QM.SRC.A → QM.APP.A',
    duration: '~30s',
  },
  {
    id: 5,
    title: 'Convert Remote Queues',
    detail: 'Reconfigure local queue definitions on QM.SRC.A as remote queue aliases pointing to QM.APP.A. In-flight tracking active.',
    icon: ArrowRightLeft,
    qm: 'QM.SRC.A',
    duration: '~15s',
  },
  {
    id: 6,
    title: 'Route Traffic',
    detail: 'Activate transmission queues and flip routing table. Confirm message flow end-to-end before finalising cutover.',
    icon: Route,
    qm: 'QM.APP.A',
    duration: '~60s',
  },
  {
    id: 7,
    title: 'Post-Rewire Validation',
    detail: 'Run latency probes and message-count assertions across the new channel. Confirm zero message loss before cutover.',
    icon: ShieldCheck,
    qm: 'QM.APP.A',
    duration: '~22s',
  },
];

const STEP_LOGS: Record<number, string[]> = {
  1: [
    'Connecting to QM.SRC.A via TLS…',
    'Snapshot captured — 12 queues, 3 channels',
    'Naming policy: PASS',
    'TLS certificate: PASS',
    'DLQ presence: PASS',
    'Baseline validation complete',
  ],
  2: [
    'Applying OCP namespace bcl-mq-target…',
    'RBAC role binding created',
    'Requesting QueueManager CR: QM.APP.A',
    'Pod scheduled — node: worker-3',
    'Waiting for QM readiness probe…',
    'QM.APP.A is Running',
  ],
  3: [
    'Fetching source queue definitions…',
    'Creating queue ORDERS.LOCAL',
    'Creating queue ORDERS.REPLY',
    'Creating queue ORDERS.DLQ',
    'Creating queue NOTIFY.LOCAL',
    'All 12 queues provisioned',
  ],
  4: [
    'Generating channel pair CHNL.SRC.APP…',
    'Injecting MCA user from sealed secret',
    'SENDER channel created on QM.SRC.A',
    'RECEIVER channel created on QM.APP.A',
    'Starting channels…',
    'Channel status: RUNNING',
  ],
  5: [
    'Quiescing traffic on QM.SRC.A…',
    'Converting ORDERS.LOCAL → remote alias',
    'Converting NOTIFY.LOCAL → remote alias',
    'Remote queue definitions applied',
    'In-flight message count: 0',
    'Conversion complete',
  ],
  6: [
    'Activating transmission queue XMIT.APP.A…',
    'Routing table update queued',
    'Flipping route: QM.SRC.A → QM.APP.A',
    'Message probe sent — roundtrip: 4ms',
    'Traffic flow confirmed',
    'Cutover live',
  ],
  7: [
    'Sending 100 probe messages…',
    'Received: 100/100 — latency p99: 6ms',
    'Message count delta: 0 (zero loss)',
    'Channel health: GOOD',
    'Final validation: PASS',
    'Migration complete',
  ],
};

const AGENT_MSGS: Record<number, string> = {
  1: 'Running step 1: Baseline Validation — checking source topology integrity.',
  2: 'Executing step 2: Provisioning QM.APP.A on target cluster.',
  3: 'Executing step 3: Creating queues — replicating source topology.',
  4: 'Executing step 4: Channel setup — MCA credentials being injected.',
  5: 'Executing step 5: Converting to remote queues — monitoring in-flight messages.',
  6: 'Executing step 6: Routing traffic — cutover in progress.',
  7: 'Executing step 7: Post-rewire validation — confirming zero message loss.',
};

const LEVEL_STYLES: Record<LogLine['level'], { color: string; bg: string; label: string }> = {
  INFO:  { color: '#38BDF8', bg: 'rgba(56,189,248,0.06)',   label: 'INFO' },
  WARN:  { color: '#FB923C', bg: 'rgba(251,146,60,0.06)',   label: 'WARN' },
  ERROR: { color: '#F87171', bg: 'rgba(248,113,113,0.08)',  label: 'ERR ' },
  DEBUG: { color: '#94A3B8', bg: 'rgba(148,163,184,0.04)',  label: 'DBG ' },
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}
function nowTs() {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

// ── Typing text ─────────────────────────────────────────────────────────────

function TypingText({ text, speed = 18 }: { text: string; speed?: number }) {
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

// ── Agent bubble ─────────────────────────────────────────────────────────────

function AgentBubble({
  messages,
  open,
  setOpen,
}: {
  messages: AgentMsg[];
  open: boolean;
  setOpen: (v: boolean) => void;
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

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      <AnimatePresence>
        {!open && last && (
          <motion.div
            key={last.id}
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(true)}
            className="cursor-pointer max-w-[260px] rounded-2xl rounded-br-sm px-3.5 py-2.5"
            style={{
              background: '#141B2D',
              border: '1px solid rgba(14,165,233,0.25)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(14,165,233,0.08)',
            }}
          >
            <div className="flex items-start gap-2">
              <span
                className="mt-1 w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: '#38BDF8', boxShadow: '0 0 6px rgba(56,189,248,0.7)' }}
              />
              <p className="text-xs leading-relaxed font-medium text-sky-300">
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
                    background: 'linear-gradient(135deg, rgba(14,165,233,0.2) 0%, rgba(2,132,199,0.1) 100%)',
                    border: '1px solid rgba(14,165,233,0.3)',
                  }}
                >
                  <Bot className="w-3.5 h-3.5 text-sky-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white leading-none">Execution Agent</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: '#22C55E', boxShadow: '0 0 4px rgba(34,197,94,0.7)' }}
                    />
                    <span className="text-[10px] text-slate-400">Active</span>
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
              {messages.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-6">Waiting for execution to start…</p>
              )}
              {messages.map((msg, i) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex gap-2 rounded-lg px-2.5 py-2"
                  style={{ background: 'rgba(14,165,233,0.08)' }}
                >
                  <span
                    className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: '#38BDF8', boxShadow: '0 0 4px rgba(56,189,248,0.5)' }}
                  />
                  <p className="text-xs leading-relaxed text-sky-300">
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
          background: open
            ? 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)'
            : 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
          boxShadow: '0 4px 16px rgba(14,165,233,0.4), 0 2px 4px rgba(0,0,0,0.4)',
          border: '1px solid rgba(56,189,248,0.3)',
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

// ── Step status icon ─────────────────────────────────────────────────────────

function StepIcon({ status, id, Icon }: { status: StepStatus; id: number; Icon: React.ElementType }) {
  return (
    <AnimatePresence mode="wait">
      {status === 'success' && (
        <motion.span key="done" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 280, damping: 22 }}>
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        </motion.span>
      )}
      {status === 'running' && (
        <motion.span key="running" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
          <Loader2 className="w-5 h-5 text-sky-400 animate-spin" />
        </motion.span>
      )}
      {status === 'failed' && (
        <motion.span key="failed" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
          <XCircle className="w-5 h-5 text-red-400" />
        </motion.span>
      )}
      {status === 'pending' && (
        <motion.span key="pending" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
          <Icon className="w-5 h-5" style={{ color: 'rgba(148,163,184,0.5)' }} />
        </motion.span>
      )}
    </AnimatePresence>
  );
}

// ── Step row ─────────────────────────────────────────────────────────────────

function StepRow({
  step,
  isLast,
  currentStep,
}: {
  step: ExecStep;
  isLast: boolean;
  currentStep: number;
}) {
  const isDone = step.status === 'success';
  const isRunning = step.status === 'running';
  const isFailed = step.status === 'failed';
  const isPending = step.status === 'pending';

  const connectorActive = step.id < currentStep || isDone;

  return (
    <motion.li
      layout
      className={`flex gap-4 ${isLast ? '' : 'pb-5'}`}
    >
      {/* Left column: indicator + connector */}
      <div className="flex flex-col items-center shrink-0" style={{ width: 44 }}>
        <motion.div
          className="w-11 h-11 rounded-2xl flex items-center justify-center relative shrink-0"
          animate={
            isRunning
              ? {
                  boxShadow: [
                    '0 0 0px rgba(56,189,248,0)',
                    '0 0 20px rgba(56,189,248,0.45)',
                    '0 0 0px rgba(56,189,248,0)',
                  ],
                }
              : {}
          }
          transition={isRunning ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : {}}
          style={{
            background: isDone
              ? 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(5,150,105,0.1) 100%)'
              : isRunning
              ? 'linear-gradient(135deg, rgba(14,165,233,0.25) 0%, rgba(2,132,199,0.15) 100%)'
              : isFailed
              ? 'linear-gradient(135deg, rgba(239,68,68,0.18) 0%, rgba(185,28,28,0.1) 100%)'
              : 'rgba(255,255,255,0.03)',
            border: isDone
              ? '1px solid rgba(16,185,129,0.4)'
              : isRunning
              ? '1px solid rgba(14,165,233,0.5)'
              : isFailed
              ? '1px solid rgba(239,68,68,0.4)'
              : '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <StepIcon status={step.status} id={step.id} Icon={step.icon} />

          {/* Step number badge */}
          <span
            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
            style={{
              background: isDone ? '#10B981' : isRunning ? '#0EA5E9' : isFailed ? '#EF4444' : 'rgba(255,255,255,0.08)',
              color: isDone || isRunning || isFailed ? '#fff' : 'rgba(255,255,255,0.3)',
              border: isDone
                ? '1px solid rgba(16,185,129,0.6)'
                : isRunning
                ? '1px solid rgba(14,165,233,0.6)'
                : isFailed
                ? '1px solid rgba(239,68,68,0.5)'
                : '1px solid rgba(255,255,255,0.1)',
            }}
          >
            {step.id}
          </span>
        </motion.div>

        {/* Connector line */}
        {!isLast && (
          <div className="w-px flex-1 mt-1 min-h-[20px] relative overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <motion.div
              className="absolute inset-x-0 top-0 rounded-full"
              initial={{ height: '0%' }}
              animate={{ height: connectorActive ? '100%' : '0%' }}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
              style={{ background: 'linear-gradient(180deg, #0EA5E9 0%, rgba(14,165,233,0.2) 100%)' }}
            />
          </div>
        )}
      </div>

      {/* Right column: content */}
      <motion.div
        className="flex-1 min-w-0 pt-1.5"
        animate={{ opacity: isPending ? 0.4 : 1 }}
        transition={{ duration: 0.35 }}
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <h3
              className="text-sm font-semibold transition-colors duration-300"
              style={{
                color: isDone ? '#34D399' : isRunning ? '#38BDF8' : isFailed ? '#F87171' : 'rgba(255,255,255,0.5)',
              }}
            >
              {step.title}
            </h3>
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.35)',
              }}
            >
              {step.qm}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="flex items-center gap-1 text-[10px] text-slate-500">
              <Clock className="w-3 h-3" />
              {step.duration}
            </span>
            <motion.span
              key={step.status}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="text-[10px] font-medium px-2 py-0.5 rounded-full capitalize"
              style={{
                background: isDone
                  ? 'rgba(16,185,129,0.12)'
                  : isRunning
                  ? 'rgba(14,165,233,0.12)'
                  : isFailed
                  ? 'rgba(239,68,68,0.12)'
                  : 'rgba(255,255,255,0.04)',
                border: isDone
                  ? '1px solid rgba(16,185,129,0.3)'
                  : isRunning
                  ? '1px solid rgba(14,165,233,0.3)'
                  : isFailed
                  ? '1px solid rgba(239,68,68,0.3)'
                  : '1px solid rgba(255,255,255,0.07)',
                color: isDone ? '#34D399' : isRunning ? '#38BDF8' : isFailed ? '#F87171' : 'rgba(255,255,255,0.25)',
              }}
            >
              {step.status}
            </motion.span>
          </div>
        </div>

        <p className="text-xs text-slate-500 mt-1 leading-relaxed pr-2">{step.detail}</p>

        {/* Running log preview */}
        <AnimatePresence>
          {isRunning && step.logs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-2 overflow-hidden"
            >
              <div
                className="rounded-lg px-3 py-2 font-mono text-[11px] space-y-0.5"
                style={{
                  background: 'rgba(14,165,233,0.05)',
                  border: '1px solid rgba(14,165,233,0.15)',
                }}
              >
                {step.logs.slice(-3).map((line, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-sky-400/80 leading-snug"
                  >
                    {i === step.logs.length - 1 || i === Math.min(step.logs.length, 3) - 1 ? (
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

// ── Live log panel ───────────────────────────────────────────────────────────

function LogPanel({ lines }: { lines: LogLine[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [lines.length]);

  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden h-full"
      style={{
        background: '#0B0F1A',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <Terminal className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs font-semibold text-slate-300 tracking-wide">Live Logs</span>
        <div className="flex items-center gap-1 ml-auto">
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: '#22C55E', boxShadow: '0 0 6px rgba(34,197,94,0.8)' }}
          />
          <span className="text-[10px] text-emerald-400 font-medium">streaming</span>
        </div>
      </div>

      {/* Log lines */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2.5 space-y-0.5 font-mono text-[11px] min-h-0">
        {lines.length === 0 && (
          <p className="text-slate-600 py-4 text-center text-xs">Waiting for execution…</p>
        )}
        <AnimatePresence initial={false}>
          {lines.map((line) => {
            const s = LEVEL_STYLES[line.level];
            return (
              <motion.div
                key={line.id}
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.18 }}
                className="flex gap-2 items-start rounded px-2 py-0.5 leading-snug"
                style={{ background: s.bg }}
              >
                <span className="text-slate-600 shrink-0 tabular-nums">{line.ts}</span>
                <span
                  className="shrink-0 font-bold tracking-wider"
                  style={{ color: s.color, fontSize: 9 }}
                >
                  {s.label}
                </span>
                <span style={{ color: s.color }}>{line.text}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

function buildSteps(): ExecStep[] {
  return INITIAL_STEPS.map((s) => ({ ...s, status: 'pending', logs: [] }));
}

let logSeq = 0;
function makeLog(level: LogLine['level'], text: string): LogLine {
  return { id: ++logSeq, ts: nowTs(), level, text };
}

export default function MigrationExecutionPage() {
  const [steps, setSteps] = useState<ExecStep[]>(buildSteps);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [agentMsgs, setAgentMsgs] = useState<AgentMsg[]>([]);
  const [agentOpen, setAgentOpen] = useState(false);
  const agentMsgIdRef = useRef(0);
  const runningRef = useRef(false);

  const pushLog = useCallback((level: LogLine['level'], text: string) => {
    setLogs((prev) => [...prev.slice(-200), makeLog(level, text)]);
  }, []);

  const pushAgent = useCallback((text: string) => {
    setAgentMsgs((prev) => [...prev, { id: ++agentMsgIdRef.current, text }]);
  }, []);

  const reset = useCallback(() => {
    runningRef.current = false;
    setSteps(buildSteps());
    setRunning(false);
    setDone(false);
    setFailed(false);
    setCurrentStep(0);
    setLogs([]);
    setAgentMsgs([]);
    logSeq = 0;
  }, []);

  const execute = useCallback(async () => {
    if (running) return;
    reset();
    await new Promise((r) => setTimeout(r, 50));
    setRunning(true);
    runningRef.current = true;

    pushLog('INFO', 'Migration execution started — app: APP.ORDER.SVC');
    pushLog('INFO', 'Source: QM.SRC.A  →  Target: QM.APP.A');

    for (let i = 0; i < INITIAL_STEPS.length; i++) {
      if (!runningRef.current) break;

      const stepId = INITIAL_STEPS[i].id;
      setCurrentStep(stepId);
      pushAgent(AGENT_MSGS[stepId]);
      setAgentOpen(true);

      // Mark running
      setSteps((prev) =>
        prev.map((s) => (s.id === stepId ? { ...s, status: 'running' } : s))
      );
      pushLog('INFO', `[Step ${stepId}] Starting: ${INITIAL_STEPS[i].title}`);

      const stepLogs = STEP_LOGS[stepId] ?? [];
      for (let j = 0; j < stepLogs.length; j++) {
        if (!runningRef.current) break;
        await new Promise((r) => setTimeout(r, 260 + Math.random() * 180));
        const logText = stepLogs[j];
        pushLog('INFO', `[Step ${stepId}] ${logText}`);

        // Push log into step's inline log preview
        setSteps((prev) =>
          prev.map((s) =>
            s.id === stepId ? { ...s, logs: [...s.logs, logText] } : s
          )
        );
      }

      if (!runningRef.current) break;
      await new Promise((r) => setTimeout(r, 200));

      // Mark success
      setSteps((prev) =>
        prev.map((s) => (s.id === stepId ? { ...s, status: 'success' } : s))
      );
      pushLog('INFO', `[Step ${stepId}] Completed: ${INITIAL_STEPS[i].title}`);
    }

    if (runningRef.current) {
      setDone(true);
      pushLog('INFO', 'Migration complete — APP.ORDER.SVC is now running on QM.APP.A');
      pushAgent('Migration complete. All 7 steps executed successfully. Zero message loss confirmed.');
    }

    setRunning(false);
    runningRef.current = false;
  }, [running, reset, pushLog, pushAgent]);

  const completedCount = steps.filter((s) => s.status === 'success').length;
  const progress = (completedCount / steps.length) * 100;

  const activeStep = steps.find((s) => s.status === 'running');

  return (
    <div className="flex flex-col gap-5 h-full">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(14,165,233,0.2) 0%, rgba(2,132,199,0.1) 100%)',
              border: '1px solid rgba(14,165,233,0.3)',
              boxShadow: '0 0 16px rgba(14,165,233,0.12)',
            }}
          >
            <Zap className="w-4.5 h-4.5 text-sky-400" style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white leading-tight">Migration Execution</h1>
            <p className="text-xs text-slate-500 mt-0.5">APP.ORDER.SVC &nbsp;·&nbsp; QM.SRC.A → QM.APP.A</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {running && (
            <div className="flex items-center gap-1.5 text-sky-400 text-xs font-medium px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)' }}>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Executing…
            </div>
          )}
          {done && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Complete
            </motion.div>
          )}
          {(done || failed) && (
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
            onClick={execute}
            disabled={running}
            whileHover={running ? {} : { scale: 1.03 }}
            whileTap={running ? {} : { scale: 0.97 }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 disabled:opacity-50"
            style={{
              background: running
                ? 'rgba(14,165,233,0.15)'
                : 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
              color: '#fff',
              border: '1px solid rgba(14,165,233,0.4)',
              boxShadow: running ? 'none' : '0 4px 16px rgba(14,165,233,0.3)',
            }}
          >
            {running ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Running…
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                {done ? 'Re-run' : 'Execute Migration'}
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {activeStep ? (
              <>
                <motion.span
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                >
                  <CircleDot className="w-3 h-3 text-sky-400" />
                </motion.span>
                <span className="text-sky-400 font-medium">{activeStep.title}</span>
              </>
            ) : done ? (
              <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3" /> All steps complete
              </span>
            ) : (
              <span>Ready to execute</span>
            )}
          </div>
          <span className="text-xs text-slate-500 tabular-nums">
            {completedCount} / {steps.length} steps
          </span>
        </div>
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <motion.div
            className="h-full rounded-full relative"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            style={{
              background: done
                ? 'linear-gradient(90deg, #10B981, #34D399)'
                : 'linear-gradient(90deg, #0EA5E9, #38BDF8)',
              boxShadow: running ? '0 0 10px rgba(14,165,233,0.5)' : done ? '0 0 10px rgba(16,185,129,0.4)' : 'none',
            }}
          >
            {/* Animated shimmer when running */}
            {running && (
              <motion.div
                className="absolute inset-y-0 w-16 rounded-full"
                animate={{ x: ['-100%', '300%'] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)' }}
              />
            )}
          </motion.div>
        </div>
      </div>

      {/* Topology migration board */}
      <DragMigrationBoard />

      {/* Main body: timeline + log panel */}
      <div className="flex gap-5 flex-1 min-h-0 overflow-hidden">
        {/* Timeline */}
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
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-300 tracking-wide">Execution Steps</span>
            <div className="ml-auto flex items-center gap-3 text-[10px] text-slate-500">
              {[
                { color: '#94A3B8', label: 'Pending' },
                { color: '#0EA5E9', label: 'Running' },
                { color: '#10B981', label: 'Success' },
                { color: '#EF4444', label: 'Failed' },
              ].map(({ color, label }) => (
                <span key={label} className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Guide line + steps */}
          <div className="relative px-5 py-5">
            <div
              className="absolute top-5 bottom-5 w-px"
              style={{
                left: 42,
                background: 'linear-gradient(180deg, rgba(14,165,233,0.2) 0%, rgba(14,165,233,0.04) 100%)',
              }}
            />
            <ol className="space-y-0 relative">
              {steps.map((step, i) => (
                <StepRow
                  key={step.id}
                  step={step}
                  isLast={i === steps.length - 1}
                  currentStep={currentStep}
                />
              ))}
            </ol>
          </div>
        </div>

        {/* Log panel */}
        <div className="w-[320px] shrink-0 flex flex-col min-h-0">
          <LogPanel lines={logs} />
        </div>
      </div>

      {/* Agent bubble */}
      <AgentBubble messages={agentMsgs} open={agentOpen} setOpen={setAgentOpen} />
    </div>
  );
}
