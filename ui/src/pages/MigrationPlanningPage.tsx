import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Play, Server, Layers, GitBranch, ArrowRightLeft, Route, CircleCheck as CheckCircle2, Clock, Loader as Loader2, Bot, X, ChevronDown, Brain, Zap } from 'lucide-react';

interface PlanStep {
  id: number;
  title: string;
  description: string;
  icon: React.ElementType;
  status: 'pending' | 'active' | 'done';
  qm?: string;
  duration?: string;
}

const INITIAL_STEPS: PlanStep[] = [
  {
    id: 1,
    title: 'Create QM_APP_A',
    description: 'Provision a dedicated queue manager for App A on the target cluster. Validates TLS certificates and applies naming policy before deployment.',
    icon: Server,
    status: 'pending',
    qm: 'QM.APP.A',
    duration: '~45s',
  },
  {
    id: 2,
    title: 'Create queues',
    description: 'Define and provision all local queues on QM_APP_A matching the source topology. Dead-letter queue (DLQ) is created automatically.',
    icon: Layers,
    status: 'pending',
    qm: 'QM.APP.A',
    duration: '~20s',
  },
  {
    id: 3,
    title: 'Setup channels',
    description: 'Establish sender/receiver channel pairs between QM.SRC.A and QM.APP.A. MCA credentials injected from sealed secrets.',
    icon: GitBranch,
    status: 'pending',
    qm: 'QM.SRC.A → QM.APP.A',
    duration: '~30s',
  },
  {
    id: 4,
    title: 'Convert to remote queues',
    description: 'Reconfigure local queue definitions on QM.SRC.A as remote queue aliases pointing to QM.APP.A. Zero message loss guaranteed via in-flight tracking.',
    icon: ArrowRightLeft,
    status: 'pending',
    qm: 'QM.SRC.A',
    duration: '~15s',
  },
  {
    id: 5,
    title: 'Route traffic',
    description: 'Activate transmission queues and flip the routing table. Run post-rewire validation to confirm message flow end-to-end before finalising cutover.',
    icon: Route,
    status: 'pending',
    qm: 'QM.APP.A',
    duration: '~60s',
  },
];

const AGENT_MESSAGES = [
  'Analysing source topology — QM.SRC.A has 12 queues.',
  'Policy check passed — TLS and naming rules satisfied.',
  'Estimated total migration time: ~2m 50s.',
  'Optimised migration order generated — 5 sequential steps.',
  'No conflicting channels detected on target cluster.',
];

interface BubbleMsg {
  id: number;
  text: string;
}

function TypingText({ text, onDone }: { text: string; onDone?: () => void }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const idx = useRef(0);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    idx.current = 0;
    const interval = setInterval(() => {
      if (idx.current < text.length) {
        setDisplayed(text.slice(0, idx.current + 1));
        idx.current++;
      } else {
        clearInterval(interval);
        setDone(true);
        onDone?.();
      }
    }, 18);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

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

function AgentBubble({ messages, open, setOpen, unread }: {
  messages: BubbleMsg[];
  open: boolean;
  setOpen: (v: boolean) => void;
  unread: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const last = messages[messages.length - 1];

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
            className="cursor-pointer max-w-[240px] rounded-2xl rounded-br-sm px-3.5 py-2.5"
            style={{
              background: '#141B2D',
              border: '1px solid #1E2A3D',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}
          >
            <div className="flex items-start gap-2">
              <span className="mt-1 w-1.5 h-1.5 rounded-full shrink-0 bg-sky-400" />
              <p className="text-xs leading-relaxed font-medium text-sky-300">{last.text}</p>
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
              boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
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
                  <Brain className="w-3.5 h-3.5 text-sky-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-text-primary leading-none">Planning Agent</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 4px rgba(34,197,94,0.7)' }} />
                    <span className="text-[10px] text-text-muted">Online</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg transition-colors hover:bg-surface-overlay text-text-muted hover:text-text-primary"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
              {messages.length === 0 && (
                <p className="text-xs text-text-muted text-center py-6">Waiting for activity…</p>
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
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-sky-400" style={{ boxShadow: '0 0 4px rgba(14,165,233,0.6)' }} />
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
        onClick={() => setOpen((v) => !v)}
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
        {unread > 0 && !open && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center bg-emerald-500"
            style={{ boxShadow: '0 0 8px rgba(34,197,94,0.6)' }}
          >
            {unread}
          </motion.span>
        )}
      </motion.button>
    </div>
  );
}

const STEP_ICON_COLORS = [
  { bg: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.3)', icon: '#38BDF8' },
  { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', icon: '#34D399' },
  { bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.3)', icon: '#FB923C' },
  { bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.3)', icon: '#C084FC' },
  { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)', icon: '#F87171' },
];

export default function MigrationPlanningPage() {
  const [steps, setSteps] = useState<PlanStep[]>(INITIAL_STEPS);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [agentMessages, setAgentMessages] = useState<BubbleMsg[]>([]);
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentUnread, setAgentUnread] = useState(0);
  const msgIdRef = useRef(0);

  const pushMessage = useCallback((text: string) => {
    const id = ++msgIdRef.current;
    setAgentMessages((prev) => [...prev, { id, text }]);
    setAgentUnread((n) => n + 1);
  }, []);

  const handleGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    setGenerated(false);
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: 'pending' })));

    // Drip agent messages
    AGENT_MESSAGES.forEach((msg, i) => {
      setTimeout(() => pushMessage(msg), i * 700 + 300);
    });

    // Animate steps appearing one by one
    for (let i = 0; i < INITIAL_STEPS.length; i++) {
      await new Promise((res) => setTimeout(res, 500 + i * 220));
      setSteps((prev) =>
        prev.map((s, idx) => (idx === i ? { ...s, status: 'active' } : s))
      );
      await new Promise((res) => setTimeout(res, 600));
      setSteps((prev) =>
        prev.map((s, idx) => (idx === i ? { ...s, status: 'done' } : s))
      );
    }

    setGenerating(false);
    setGenerated(true);
  };

  const completedCount = steps.filter((s) => s.status === 'done').length;

  const handleAgentOpen = (v: boolean) => {
    setAgentOpen(v);
    if (v) setAgentUnread(0);
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-text-secondary" />
        <h1 className="text-xl font-semibold text-text-primary">Migration Planning</h1>
      </div>

      {/* AI Suggested Plan banner */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-xl px-5 py-4 flex items-start gap-4"
        style={{
          background: 'linear-gradient(135deg, rgba(14,165,233,0.08) 0%, rgba(2,132,199,0.04) 100%)',
          border: '1px solid rgba(14,165,233,0.2)',
          boxShadow: '0 2px 12px rgba(14,165,233,0.06)',
        }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: 'linear-gradient(135deg, rgba(14,165,233,0.2) 0%, rgba(2,132,199,0.1) 100%)',
            border: '1px solid rgba(14,165,233,0.3)',
          }}
        >
          <Brain className="w-4.5 h-4.5 text-sky-400" style={{ width: 18, height: 18 }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-sky-300">AI Suggested Plan</span>
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(14,165,233,0.12)',
                border: '1px solid rgba(14,165,233,0.25)',
                color: '#7DD3FC',
              }}
            >
              Powered by ControlMesh AI
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-1 leading-relaxed">
            The agent analyses your source topology, applies naming and TLS policies, and produces an
            optimised step sequence that minimises downtime and guarantees zero message loss.
          </p>
        </div>
      </motion.div>

      {/* Generate button */}
      <div className="flex items-center gap-4">
        <motion.button
          onClick={handleGenerate}
          disabled={generating}
          whileHover={generating ? {} : { scale: 1.02 }}
          whileTap={generating ? {} : { scale: 0.97 }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 disabled:opacity-60"
          style={{
            background: generating
              ? 'rgba(14,165,233,0.15)'
              : 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
            color: '#fff',
            border: '1px solid rgba(14,165,233,0.4)',
            boxShadow: generating ? 'none' : '0 4px 16px rgba(14,165,233,0.3)',
          }}
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating plan…
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Generate Migration Plan
            </>
          )}
        </motion.button>

        <AnimatePresence>
          {generated && !generating && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1.5 text-emerald-400 text-sm font-medium"
            >
              <CheckCircle2 className="w-4 h-4" />
              Plan ready — {INITIAL_STEPS.length} steps
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Progress bar shown during/after generation */}
      <AnimatePresence>
        {(generating || generated) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="flex justify-between text-xs text-text-muted mb-1.5">
              <span>Steps analysed</span>
              <span>{completedCount} / {INITIAL_STEPS.length}</span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <motion.div
                className="h-full rounded-full"
                animate={{ width: `${(completedCount / INITIAL_STEPS.length) * 100}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                style={{ background: 'linear-gradient(90deg, #0EA5E9, #34D399)' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vertical timeline */}
      <div className="relative">
        {/* Vertical guide line */}
        <div
          className="absolute left-[22px] top-6 bottom-6 w-px"
          style={{ background: 'linear-gradient(180deg, rgba(14,165,233,0.3) 0%, rgba(14,165,233,0.05) 100%)' }}
        />

        <ol className="space-y-0">
          {steps.map((step, i) => {
            const isLast = i === steps.length - 1;
            const isDone = step.status === 'done';
            const isActive = step.status === 'active';
            const colorSet = STEP_ICON_COLORS[i % STEP_ICON_COLORS.length];
            const Icon = step.icon;

            return (
              <motion.li
                key={step.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: i * 0.06 }}
                className={`relative flex gap-4 ${isLast ? '' : 'pb-6'}`}
              >
                {/* Step indicator */}
                <div className="shrink-0 flex flex-col items-center" style={{ width: 44 }}>
                  <motion.div
                    animate={
                      isActive
                        ? { scale: [1, 1.1, 1], boxShadow: ['0 0 0px rgba(14,165,233,0)', '0 0 16px rgba(14,165,233,0.5)', '0 0 0px rgba(14,165,233,0)'] }
                        : {}
                    }
                    transition={isActive ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : {}}
                    className="w-11 h-11 rounded-2xl flex items-center justify-center relative"
                    style={{
                      background: isDone
                        ? 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(5,150,105,0.1) 100%)'
                        : isActive
                        ? 'linear-gradient(135deg, rgba(14,165,233,0.25) 0%, rgba(2,132,199,0.15) 100%)'
                        : colorSet.bg,
                      border: isDone
                        ? '1px solid rgba(16,185,129,0.4)'
                        : isActive
                        ? '1px solid rgba(14,165,233,0.5)'
                        : `1px solid ${colorSet.border}`,
                    }}
                  >
                    <AnimatePresence mode="wait">
                      {isDone ? (
                        <motion.span
                          key="done"
                          initial={{ scale: 0, rotate: -45 }}
                          animate={{ scale: 1, rotate: 0 }}
                          exit={{ scale: 0 }}
                          transition={{ duration: 0.25, type: 'spring', stiffness: 260, damping: 20 }}
                        >
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        </motion.span>
                      ) : isActive ? (
                        <motion.span
                          key="active"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                        >
                          <Loader2 className="w-5 h-5 text-sky-400 animate-spin" />
                        </motion.span>
                      ) : (
                        <motion.span
                          key="idle"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                        >
                          <Icon className="w-5 h-5" style={{ color: colorSet.icon }} />
                        </motion.span>
                      )}
                    </AnimatePresence>

                    {/* Step number badge */}
                    <span
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                      style={{
                        background: isDone ? '#10B981' : isActive ? '#0EA5E9' : 'rgba(255,255,255,0.1)',
                        color: isDone || isActive ? '#fff' : 'rgba(255,255,255,0.4)',
                        border: isDone ? '1px solid rgba(16,185,129,0.5)' : isActive ? '1px solid rgba(14,165,233,0.5)' : '1px solid rgba(255,255,255,0.1)',
                      }}
                    >
                      {step.id}
                    </span>
                  </motion.div>
                </div>

                {/* Content */}
                <motion.div
                  className="flex-1 min-w-0 pt-1.5"
                  animate={{ opacity: step.status === 'pending' ? 0.55 : 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3
                        className="text-sm font-semibold transition-colors duration-300"
                        style={{
                          color: isDone ? '#34D399' : isActive ? '#38BDF8' : 'rgba(255,255,255,0.85)',
                        }}
                      >
                        {step.title}
                      </h3>
                      {step.qm && (
                        <span
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: 'rgba(255,255,255,0.4)',
                          }}
                        >
                          {step.qm}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {step.duration && (
                        <span className="flex items-center gap-1 text-[10px] text-text-muted">
                          <Clock className="w-3 h-3" />
                          {step.duration}
                        </span>
                      )}
                      <motion.span
                        key={step.status}
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2 }}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full capitalize"
                        style={{
                          background: isDone
                            ? 'rgba(16,185,129,0.12)'
                            : isActive
                            ? 'rgba(14,165,233,0.12)'
                            : 'rgba(255,255,255,0.04)',
                          border: isDone
                            ? '1px solid rgba(16,185,129,0.3)'
                            : isActive
                            ? '1px solid rgba(14,165,233,0.3)'
                            : '1px solid rgba(255,255,255,0.08)',
                          color: isDone ? '#34D399' : isActive ? '#38BDF8' : 'rgba(255,255,255,0.3)',
                        }}
                      >
                        {isDone ? 'ready' : isActive ? 'planning…' : 'pending'}
                      </motion.span>
                    </div>
                  </div>
                  <p className="text-xs text-text-muted mt-1.5 leading-relaxed pr-2">
                    {step.description}
                  </p>
                </motion.div>
              </motion.li>
            );
          })}
        </ol>
      </div>

      {/* Floating agent bubble */}
      <AgentBubble
        messages={agentMessages}
        open={agentOpen}
        setOpen={handleAgentOpen}
        unread={agentUnread}
      />
    </div>
  );
}
