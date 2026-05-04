import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Zap, ChevronDown, RotateCcw, CircleCheck as CheckCircle2, Circle as XCircle, Loader as Loader2, ShieldCheck, Play, GitBranch, Layers, TriangleAlert as AlertTriangle, ArrowRight, Cpu, Sparkles, Activity } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

type PipelineStage = 'idle' | 'planning' | 'execution' | 'validation' | 'rollback' | 'success' | 'failure';
type StageStatus = 'idle' | 'active' | 'done' | 'failed' | 'skipped';

interface ChatMsg {
  id: number;
  text: string;
  type: 'info' | 'success' | 'warning' | 'error';
  ts: string;
}

interface AppMigration {
  id: string;
  source: string;
  target: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
}

// ── Constants ────────────────────────────────────────────────────────────────

const APPS: AppMigration[] = [
  { id: 'APP1', source: 'QM.SRC.A', target: 'QM.APP1', status: 'pending' },
  { id: 'APP2', source: 'QM.SRC.A', target: 'QM.APP2', status: 'pending' },
  { id: 'APP3', source: 'QM.SRC.A', target: 'QM.APP3', status: 'pending' },
  { id: 'APP4', source: 'QM.SRC.B', target: 'QM.APP4', status: 'pending' },
  { id: 'APP5', source: 'QM.SRC.B', target: 'QM.APP5', status: 'pending' },
  { id: 'APP6', source: 'QM.SRC.B', target: 'QM.APP6', status: 'pending' },
];

const PIPELINE_STAGES = [
  { key: 'planning',   label: 'Planning',   icon: Sparkles,   color: '#38BDF8' },
  { key: 'execution',  label: 'Execution',  icon: Cpu,        color: '#818CF8' },
  { key: 'validation', label: 'Validation', icon: ShieldCheck, color: '#34D399' },
  { key: 'rollback',   label: 'Rollback',   icon: GitBranch,  color: '#FB923C' },
] as const;

// Simulated narration script per stage per app
const PLANNING_MSGS = [
  (id: string, src: string, tgt: string) =>
    `Analysing topology for ${id}: scanning ${src} — found 12 queues, 3 channels.`,
  (id: string, _src: string, tgt: string) =>
    `Generating migration plan for ${id}: 7 steps targeting ${tgt}.`,
  (id: string) => `Plan validated for ${id} — naming policy, TLS, DLQ all passed.`,
];

const EXEC_MSGS = [
  (id: string) => `Provisioning target QM for ${id}…`,
  (id: string, _src: string, tgt: string) => `Creating queues on ${tgt} — replicating source topology.`,
  (id: string, src: string, tgt: string) =>
    `Channel pair ${src} → ${tgt} established. MCA credentials injected.`,
  (id: string, src: string) =>
    `Converting ${src} local queues to remote aliases. Traffic rewired.`,
];

const VALIDATION_MSGS = [
  (id: string) => `Running latency probes for ${id} — roundtrip: 4ms.`,
  (id: string) => `Message count delta: 0. Zero loss confirmed for ${id}.`,
  (id: string, _src: string, tgt: string) => `${id} validated on ${tgt}. Migration complete.`,
];

function pad2(n: number) { return String(n).padStart(2, '0'); }
function nowTs() {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

let msgId = 0;
function makeMsg(text: string, type: ChatMsg['type'] = 'info'): ChatMsg {
  return { id: ++msgId, text, type, ts: nowTs() };
}

// ── TypingText ────────────────────────────────────────────────────────────────

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

// ── Flow Diagram ──────────────────────────────────────────────────────────────

function FlowDiagram({
  stageStatuses,
  currentStage,
}: {
  stageStatuses: Record<string, StageStatus>;
  currentStage: PipelineStage;
}) {
  const isRunning = currentStage !== 'idle' && currentStage !== 'success' && currentStage !== 'failure';

  return (
    <div className="flex items-center justify-center gap-0 w-full">
      {PIPELINE_STAGES.map((stage, i) => {
        const status = stageStatuses[stage.key] ?? 'idle';
        const isActive = status === 'active';
        const isDone = status === 'done';
        const isFailed = status === 'failed';
        const isSkipped = status === 'skipped';
        const isPending = status === 'idle';
        const Icon = stage.icon;

        return (
          <div key={stage.key} className="flex items-center">
            {/* Stage node */}
            <div className="flex flex-col items-center gap-2">
              <motion.div
                animate={
                  isActive
                    ? {
                        boxShadow: [
                          `0 0 0px ${stage.color}00`,
                          `0 0 32px ${stage.color}70`,
                          `0 0 0px ${stage.color}00`,
                        ],
                      }
                    : {}
                }
                transition={isActive ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } : {}}
                className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{
                  background: isDone
                    ? `linear-gradient(135deg, ${stage.color}22, ${stage.color}0d)`
                    : isActive
                    ? `linear-gradient(135deg, ${stage.color}30, ${stage.color}18)`
                    : isFailed
                    ? 'linear-gradient(135deg, rgba(248,113,113,0.2), rgba(248,113,113,0.08))'
                    : 'rgba(255,255,255,0.03)',
                  border: isDone
                    ? `2px solid ${stage.color}55`
                    : isActive
                    ? `2px solid ${stage.color}80`
                    : isFailed
                    ? '2px solid rgba(248,113,113,0.5)'
                    : '2px solid rgba(255,255,255,0.07)',
                  transition: 'all 0.4s ease',
                }}
              >
                <AnimatePresence mode="wait">
                  {isDone && (
                    <motion.span
                      key="done"
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    >
                      <CheckCircle2 className="w-7 h-7" style={{ color: stage.color }} />
                    </motion.span>
                  )}
                  {isActive && (
                    <motion.span key="active" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                      <Icon className="w-7 h-7 animate-pulse" style={{ color: stage.color }} />
                    </motion.span>
                  )}
                  {isFailed && (
                    <motion.span key="failed" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                      <XCircle className="w-7 h-7 text-red-400" />
                    </motion.span>
                  )}
                  {(isPending || isSkipped) && (
                    <motion.span key="pending" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                      <Icon className="w-6 h-6" style={{ color: 'rgba(148,163,184,0.3)' }} />
                    </motion.span>
                  )}
                </AnimatePresence>

                {/* Active pulse ring */}
                {isActive && (
                  <>
                    <motion.span
                      className="absolute inset-0 rounded-2xl"
                      animate={{ opacity: [0, 0.5, 0], scale: [1, 1.25, 1.5] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                      style={{ border: `1px solid ${stage.color}`, borderRadius: 16 }}
                    />
                  </>
                )}
              </motion.div>

              <div className="text-center">
                <div
                  className="text-xs font-semibold transition-all duration-300"
                  style={{
                    color: isDone
                      ? stage.color
                      : isActive
                      ? stage.color
                      : isFailed
                      ? '#F87171'
                      : 'rgba(148,163,184,0.4)',
                  }}
                >
                  {stage.label}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: 'rgba(148,163,184,0.3)' }}>
                  {isDone ? 'done' : isActive ? 'active' : isFailed ? 'failed' : isSkipped ? 'skipped' : 'waiting'}
                </div>
              </div>
            </div>

            {/* Connector arrow (not after last) */}
            {i < PIPELINE_STAGES.length - 1 && (
              <div className="flex items-center mx-2 mt-[-20px]">
                <div
                  className="h-px w-10 relative overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  {/* Animated particle when running */}
                  {isRunning && (
                    <motion.div
                      className="absolute top-0 h-full w-4 rounded-full"
                      animate={{ x: ['-100%', '300%'] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: 'linear', delay: i * 0.3 }}
                      style={{
                        background: `linear-gradient(90deg, transparent, ${PIPELINE_STAGES[i].color}80, transparent)`,
                      }}
                    />
                  )}
                  {/* Fill when stage i is done */}
                  {(stageStatuses[PIPELINE_STAGES[i].key] === 'done') && (
                    <motion.div
                      className="absolute inset-0"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      style={{
                        transformOrigin: 'left',
                        background: `linear-gradient(90deg, ${PIPELINE_STAGES[i].color}60, ${PIPELINE_STAGES[i + 1]?.color ?? PIPELINE_STAGES[i].color}40)`,
                      }}
                      transition={{ duration: 0.5 }}
                    />
                  )}
                </div>
                <ArrowRight
                  className="w-3 h-3 shrink-0"
                  style={{ color: 'rgba(148,163,184,0.2)' }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── App Fleet Progress ────────────────────────────────────────────────────────

function AppFleetGrid({ apps }: { apps: AppMigration[] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {apps.map((app) => {
        const isRunning = app.status === 'running';
        const isDone = app.status === 'done';
        const isFailed = app.status === 'failed';
        const isSkipped = app.status === 'skipped';

        return (
          <motion.div
            key={app.id}
            layout
            className="rounded-xl px-3 py-2.5 flex flex-col gap-1"
            style={{
              background: isDone
                ? 'rgba(16,185,129,0.07)'
                : isRunning
                ? 'rgba(14,165,233,0.08)'
                : isFailed
                ? 'rgba(239,68,68,0.07)'
                : 'rgba(255,255,255,0.02)',
              border: isDone
                ? '1px solid rgba(16,185,129,0.25)'
                : isRunning
                ? '1px solid rgba(14,165,233,0.3)'
                : isFailed
                ? '1px solid rgba(239,68,68,0.25)'
                : '1px solid rgba(255,255,255,0.06)',
              transition: 'all 0.3s ease',
            }}
          >
            <div className="flex items-center justify-between">
              <span
                className="text-xs font-bold"
                style={{
                  color: isDone
                    ? '#34D399'
                    : isRunning
                    ? '#38BDF8'
                    : isFailed
                    ? '#F87171'
                    : 'rgba(255,255,255,0.35)',
                }}
              >
                {app.id}
              </span>
              <span>
                {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                {isRunning && <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin" />}
                {isFailed && <XCircle className="w-3.5 h-3.5 text-red-400" />}
                {isSkipped && <span className="text-[9px] text-slate-500">skip</span>}
                {app.status === 'pending' && (
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ background: 'rgba(255,255,255,0.12)' }}
                  />
                )}
              </span>
            </div>
            <div className="text-[9px] font-mono text-slate-500 leading-snug">
              {app.source} → {app.target}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ── Agent Chat ────────────────────────────────────────────────────────────────

function AgentChat({ msgs, open, onToggle }: { msgs: ChatMsg[]; open: boolean; onToggle: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const last = msgs[msgs.length - 1];

  useEffect(() => {
    if (open && scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 80);
    }
  }, [open, msgs.length]);

  const typeColors: Record<ChatMsg['type'], string> = {
    info: '#38BDF8',
    success: '#34D399',
    warning: '#FB923C',
    error: '#F87171',
  };

  const typeBg: Record<ChatMsg['type'], string> = {
    info: 'rgba(56,189,248,0.07)',
    success: 'rgba(52,211,153,0.07)',
    warning: 'rgba(251,146,60,0.07)',
    error: 'rgba(248,113,113,0.07)',
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      <AnimatePresence>
        {!open && last && (
          <motion.div
            key={last.id}
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2 }}
            onClick={onToggle}
            className="cursor-pointer max-w-[280px] rounded-2xl rounded-br-sm px-3.5 py-2.5"
            style={{
              background: '#141B2D',
              border: `1px solid ${typeColors[last.type]}30`,
              boxShadow: `0 8px 24px rgba(0,0,0,0.45), 0 0 0 1px ${typeColors[last.type]}10`,
            }}
          >
            <div className="flex items-start gap-2">
              <span
                className="mt-1 w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: typeColors[last.type], boxShadow: `0 0 6px ${typeColors[last.type]}90` }}
              />
              <p className="text-xs leading-relaxed font-medium" style={{ color: typeColors[last.type] }}>
                <TypingText text={last.text} speed={12} />
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
              width: 320,
              maxHeight: 400,
              background: '#141B2D',
              border: '1px solid #1E2A3D',
              boxShadow: '0 24px 48px rgba(0,0,0,0.5), 0 8px 16px rgba(0,0,0,0.4)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 shrink-0"
              style={{ borderBottom: '1px solid #1E2A3D', background: 'rgba(10,14,26,0.5)' }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(129,140,248,0.2), rgba(99,102,241,0.1))',
                    border: '1px solid rgba(129,140,248,0.3)',
                  }}
                >
                  <Bot className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white leading-none">Autonomous Agent</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <motion.span
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: '#22C55E', boxShadow: '0 0 4px rgba(34,197,94,0.7)' }}
                    />
                    <span className="text-[10px] text-slate-400">Narrating</span>
                  </div>
                </div>
              </div>
              <button
                onClick={onToggle}
                className="p-1.5 rounded-lg transition-colors hover:bg-white/5 text-slate-400 hover:text-white"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
              {msgs.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-6">Waiting for autonomous run to start…</p>
              )}
              {msgs.map((msg, i) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex gap-2 rounded-lg px-2.5 py-2"
                  style={{ background: typeBg[msg.type] }}
                >
                  <span
                    className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: typeColors[msg.type], boxShadow: `0 0 4px ${typeColors[msg.type]}70` }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-relaxed" style={{ color: typeColors[msg.type] }}>
                      {i === msgs.length - 1 ? <TypingText text={msg.text} /> : msg.text}
                    </p>
                    <span className="text-[9px] text-slate-600 tabular-nums">{msg.ts}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB */}
      <motion.button
        onClick={onToggle}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className="relative w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{
          background: open
            ? 'linear-gradient(135deg, #4F46E5, #6366F1)'
            : 'linear-gradient(135deg, #6366F1, #818CF8)',
          boxShadow: '0 4px 16px rgba(99,102,241,0.45), 0 2px 4px rgba(0,0,0,0.4)',
          border: '1px solid rgba(129,140,248,0.35)',
        }}
      >
        {msgs.length > 0 && !open && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
            style={{ background: '#EF4444', border: '1.5px solid #0B0F1A' }}
          >
            {msgs.length > 9 ? '9+' : msgs.length}
          </motion.span>
        )}
        {/* Pulse rings */}
        {msgs.length > 0 && !open && (
          <motion.span
            className="absolute inset-0 rounded-2xl"
            animate={{ opacity: [0.6, 0], scale: [1, 1.5] }}
            transition={{ duration: 1.8, repeat: Infinity }}
            style={{ border: '1px solid rgba(99,102,241,0.6)' }}
          />
        )}
        <AnimatePresence mode="wait">
          {open ? (
            <motion.span key="x" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}>
              <ChevronDown className="w-5 h-5 text-white" />
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

// ── Final State Banner ────────────────────────────────────────────────────────

function FinalBanner({ state }: { state: 'success' | 'failure' }) {
  const isSuccess = state === 'success';
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 240, damping: 20, delay: 0.1 }}
      className="rounded-2xl px-8 py-6 flex flex-col items-center gap-3 text-center"
      style={{
        background: isSuccess
          ? 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(5,150,105,0.06) 100%)'
          : 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(185,28,28,0.06) 100%)',
        border: isSuccess
          ? '1px solid rgba(16,185,129,0.35)'
          : '1px solid rgba(239,68,68,0.35)',
        boxShadow: isSuccess
          ? '0 0 40px rgba(16,185,129,0.1), inset 0 1px 0 rgba(52,211,153,0.08)'
          : '0 0 40px rgba(239,68,68,0.1), inset 0 1px 0 rgba(248,113,113,0.08)',
      }}
    >
      <motion.div
        animate={isSuccess ? { rotate: [0, 8, -8, 0] } : {}}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        {isSuccess ? (
          <CheckCircle2 className="w-12 h-12 text-emerald-400" />
        ) : (
          <AlertTriangle className="w-12 h-12 text-red-400" />
        )}
      </motion.div>
      <div>
        <div
          className="text-2xl font-bold tracking-tight"
          style={{ color: isSuccess ? '#34D399' : '#F87171' }}
        >
          {isSuccess ? 'MIGRATION SUCCESS' : 'MIGRATION FAILED'}
        </div>
        <div className="text-sm text-slate-400 mt-1">
          {isSuccess
            ? 'All 6 applications migrated successfully. Zero message loss.'
            : 'Migration encountered errors. Rollback applied. Manual review required.'}
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function buildApps(): AppMigration[] {
  return APPS.map((a) => ({ ...a, status: 'pending' }));
}

function buildStageStatuses(): Record<string, StageStatus> {
  return { planning: 'idle', execution: 'idle', validation: 'idle', rollback: 'idle' };
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function AutonomousModePage() {
  const [running, setRunning] = useState(false);
  const [currentStage, setCurrentStage] = useState<PipelineStage>('idle');
  const [stageStatuses, setStageStatuses] = useState<Record<string, StageStatus>>(buildStageStatuses);
  const [apps, setApps] = useState<AppMigration[]>(buildApps);
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef(false);

  const pushMsg = useCallback((text: string, type: ChatMsg['type'] = 'info') => {
    setChatMsgs((prev) => [...prev, makeMsg(text, type)]);
  }, []);

  const setStageActive = useCallback((stage: keyof typeof stageStatuses) => {
    setCurrentStage(stage as PipelineStage);
    setStageStatuses((prev) => ({ ...prev, [stage]: 'active' }));
  }, []);

  const setStageComplete = useCallback((stage: keyof typeof stageStatuses, failed = false) => {
    setStageStatuses((prev) => ({ ...prev, [stage]: failed ? 'failed' : 'done' }));
  }, []);

  const updateApp = useCallback((id: string, status: AppMigration['status']) => {
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  }, []);

  const reset = useCallback(() => {
    abortRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    setRunning(false);
    setCurrentStage('idle');
    setStageStatuses(buildStageStatuses());
    setApps(buildApps());
    setChatMsgs([]);
    setChatOpen(false);
    setElapsed(0);
    msgId = 0;
  }, []);

  const run = useCallback(async () => {
    if (running) return;
    reset();
    await delay(50);
    abortRef.current = false;
    setRunning(true);
    setChatOpen(true);

    // Timer
    const start = Date.now();
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);

    pushMsg('Autonomous migration sequence initiated. Scanning fleet topology…', 'info');
    await delay(700);

    // ── PLANNING ────────────────────────────────────────────────────────────
    setStageActive('planning');
    pushMsg('Phase 1: Planning — generating migration plans for all 6 applications.', 'info');
    await delay(600);

    for (const app of APPS) {
      if (abortRef.current) break;
      updateApp(app.id, 'running');
      for (const fn of PLANNING_MSGS) {
        await delay(500 + Math.random() * 300);
        pushMsg(fn(app.id, app.source, app.target), 'info');
      }
      updateApp(app.id, 'pending'); // reset to pending before execution
      await delay(300);
    }

    if (abortRef.current) return;
    setStageComplete('planning');
    pushMsg('All 6 migration plans validated. Proceeding to execution.', 'success');
    await delay(600);

    // ── EXECUTION ────────────────────────────────────────────────────────────
    setStageActive('execution');
    pushMsg('Phase 2: Execution — deploying all applications to target queue managers.', 'info');
    await delay(500);

    for (const app of APPS) {
      if (abortRef.current) break;
      updateApp(app.id, 'running');
      for (const fn of EXEC_MSGS) {
        await delay(500 + Math.random() * 400);
        pushMsg(fn(app.id, app.source, app.target), 'info');
      }
      updateApp(app.id, 'done');
      pushMsg(`${app.id} execution complete — traffic rewired to ${app.target}.`, 'success');
      await delay(300);
    }

    if (abortRef.current) return;
    setStageComplete('execution');
    pushMsg('All applications executing. Initiating validation phase.', 'success');
    await delay(600);

    // ── VALIDATION ───────────────────────────────────────────────────────────
    setStageActive('validation');
    pushMsg('Phase 3: Validation — running latency probes and message integrity checks.', 'info');
    await delay(500);

    let allPassed = true;
    for (const app of APPS) {
      if (abortRef.current) break;
      updateApp(app.id, 'running');
      for (const fn of VALIDATION_MSGS) {
        await delay(400 + Math.random() * 300);
        pushMsg(fn(app.id, app.source, app.target), 'info');
      }
      updateApp(app.id, 'done');
      await delay(200);
    }

    if (abortRef.current) return;

    if (allPassed) {
      setStageComplete('validation');
      setStageStatuses((prev) => ({ ...prev, rollback: 'skipped' }));
      pushMsg('Validation passed for all 6 apps. Zero message loss confirmed.', 'success');
      await delay(700);
      setCurrentStage('success');
      pushMsg('Autonomous migration complete. All systems healthy.', 'success');
    } else {
      setStageComplete('validation', true);
      setStageActive('rollback');
      pushMsg('Validation failed. Initiating automatic rollback sequence…', 'error');
      await delay(1200);
      setStageComplete('rollback');
      setCurrentStage('failure');
      pushMsg('Rollback applied. Topology restored to source state.', 'warning');
    }

    if (timerRef.current) clearInterval(timerRef.current);
    setRunning(false);
  }, [running, reset, pushMsg, setStageActive, setStageComplete, updateApp]);

  const finalState =
    currentStage === 'success' ? 'success' : currentStage === 'failure' ? 'failure' : null;

  const doneCount = apps.filter((a) => a.status === 'done').length;

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(129,140,248,0.25), rgba(99,102,241,0.12))',
              border: '1px solid rgba(129,140,248,0.35)',
              boxShadow: '0 0 20px rgba(99,102,241,0.15)',
            }}
          >
            <Cpu className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white leading-tight flex items-center gap-2">
              Autonomous Mode
              {running && (
                <motion.span
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(129,140,248,0.12)',
                    border: '1px solid rgba(129,140,248,0.3)',
                    color: '#818CF8',
                  }}
                >
                  LIVE
                </motion.span>
              )}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Fully automated fleet migration — plan, execute, validate, rollback</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {running && (
            <div
              className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg tabular-nums"
              style={{
                background: 'rgba(129,140,248,0.07)',
                border: '1px solid rgba(129,140,248,0.2)',
                color: '#818CF8',
              }}
            >
              <Activity className="w-3.5 h-3.5" />
              {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
            </div>
          )}

          {(finalState || !running) && currentStage !== 'idle' && (
            <motion.button
              onClick={reset}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium"
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
        </div>
      </div>

      {/* Big Launch Button — idle only */}
      <AnimatePresence>
        {currentStage === 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center gap-4 py-8"
          >
            {/* Ambient glow behind button */}
            <div
              className="absolute pointer-events-none rounded-full blur-3xl"
              style={{
                width: 320,
                height: 120,
                background: 'radial-gradient(ellipse, rgba(99,102,241,0.18) 0%, transparent 70%)',
              }}
            />

            <motion.button
              onClick={run}
              whileHover={{ scale: 1.03, boxShadow: '0 12px 40px rgba(99,102,241,0.55), 0 4px 16px rgba(0,0,0,0.5)' }}
              whileTap={{ scale: 0.97 }}
              className="relative flex items-center gap-3 px-10 py-4 rounded-2xl text-base font-bold tracking-wide"
              style={{
                background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 50%, #4338CA 100%)',
                color: '#fff',
                border: '1px solid rgba(129,140,248,0.5)',
                boxShadow: '0 8px 32px rgba(99,102,241,0.4), 0 2px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)',
              }}
            >
              {/* Shimmer */}
              <motion.div
                className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)',
                }}
              />
              <Zap className="w-5 h-5 relative z-10" />
              <span className="relative z-10">Run Autonomous Migration</span>
              <Sparkles className="w-4 h-4 relative z-10 opacity-70" />
            </motion.button>

            <p className="text-xs text-slate-500 text-center max-w-xs">
              Fully automated: plans, executes, validates, and rolls back if needed — no human intervention required.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active pipeline UI */}
      <AnimatePresence>
        {currentStage !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col gap-5"
          >
            {/* Flow diagram card */}
            <div
              className="rounded-2xl p-6"
              style={{
                background: 'rgba(255,255,255,0.015)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div className="flex items-center gap-2 mb-5">
                <Activity className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-semibold text-slate-300 tracking-wide uppercase">Pipeline</span>
                {running && (
                  <span
                    className="ml-auto flex items-center gap-1.5 text-[10px] font-medium"
                    style={{ color: '#818CF8' }}
                  >
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Processing
                  </span>
                )}
              </div>
              <FlowDiagram stageStatuses={stageStatuses} currentStage={currentStage} />
            </div>

            {/* Bottom row: fleet grid + final state */}
            <div className="grid grid-cols-2 gap-5">
              {/* Fleet progress */}
              <div
                className="rounded-2xl p-4"
                style={{
                  background: 'rgba(255,255,255,0.015)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-300 tracking-wide uppercase">Fleet Progress</span>
                  <span
                    className="ml-auto text-xs font-mono tabular-nums"
                    style={{ color: doneCount === 6 ? '#34D399' : '#818CF8' }}
                  >
                    {doneCount} / 6
                  </span>
                </div>

                {/* Overall progress bar */}
                <div className="mb-3 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    animate={{ width: `${(doneCount / 6) * 100}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    style={{
                      background: doneCount === 6
                        ? 'linear-gradient(90deg, #10B981, #34D399)'
                        : 'linear-gradient(90deg, #6366F1, #818CF8)',
                      boxShadow: running ? '0 0 8px rgba(99,102,241,0.5)' : 'none',
                    }}
                  />
                </div>

                <AppFleetGrid apps={apps} />
              </div>

              {/* Final state or current stage info */}
              <div className="flex items-center justify-center">
                <AnimatePresence mode="wait">
                  {finalState ? (
                    <FinalBanner key="final" state={finalState} />
                  ) : (
                    <motion.div
                      key="active-info"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center gap-4 text-center px-4"
                    >
                      <motion.div
                        animate={{
                          boxShadow: [
                            '0 0 0px rgba(129,140,248,0)',
                            '0 0 30px rgba(129,140,248,0.4)',
                            '0 0 0px rgba(129,140,248,0)',
                          ],
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-16 h-16 rounded-2xl flex items-center justify-center"
                        style={{
                          background: 'linear-gradient(135deg, rgba(129,140,248,0.2), rgba(99,102,241,0.1))',
                          border: '1px solid rgba(129,140,248,0.3)',
                        }}
                      >
                        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                      </motion.div>
                      <div>
                        <div className="text-sm font-semibold text-white capitalize">
                          {currentStage === 'planning' && 'Analysing & Planning'}
                          {currentStage === 'execution' && 'Executing Migrations'}
                          {currentStage === 'validation' && 'Validating Results'}
                          {currentStage === 'rollback' && 'Rolling Back'}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">Agent running autonomously…</div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Agent chat */}
      <AgentChat msgs={chatMsgs} open={chatOpen} onToggle={() => setChatOpen((v) => !v)} />
    </div>
  );
}
