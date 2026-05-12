import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Play, Server, Layers, GitBranch, ArrowRightLeft, Route, CircleCheck as CheckCircle2, Clock, Loader as Loader2, Bot, X, ChevronDown, Brain, Zap, RotateCcw, TriangleAlert as AlertTriangle, ArrowRight, Database, Shield, FileText, CirclePlay as PlayCircle } from 'lucide-react';
import { useAppStore } from '../store/appStore';

interface PlanStep {
  id: number;
  title: string;
  description: string;
  icon: React.ElementType;
  status: 'pending' | 'active' | 'done';
  qm?: string;
  duration?: string;
  type: 'migration' | 'rollback';
}

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
        <span className="inline-block w-0.5 h-3 ml-0.5 align-middle animate-pulse" style={{ background: 'currentColor' }} />
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
            style={{ background: '#141B2D', border: '1px solid #1E2A3D', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
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
            style={{ width: '300px', maxHeight: '380px', background: '#141B2D', border: '1px solid #1E2A3D', boxShadow: '0 24px 48px rgba(0,0,0,0.5)' }}
          >
            <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid #1E2A3D', background: 'rgba(10,14,26,0.5)' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.2) 0%, rgba(2,132,199,0.1) 100%)', border: '1px solid rgba(14,165,233,0.3)' }}>
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
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg transition-colors hover:bg-surface-overlay text-text-muted hover:text-text-primary">
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
        onClick={() => setOpen(!open)}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className="relative w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{
          background: open ? 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)' : 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
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
  { bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.3)', icon: '#4ADE80' },
  { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)', icon: '#F87171' },
];

const ROLLBACK_COLORS = [
  { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', icon: '#F87171' },
  { bg: 'rgba(251,146,60,0.08)', border: 'rgba(251,146,60,0.25)', icon: '#FB923C' },
  { bg: 'rgba(234,179,8,0.08)', border: 'rgba(234,179,8,0.25)', icon: '#FACC15' },
  { bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.25)', icon: '#818CF8' },
];

function PlanTimeline({ steps, title, accent, onGenerate, generating, generated }: {
  steps: PlanStep[];
  title: string;
  accent: 'blue' | 'red';
  onGenerate: () => void;
  generating: boolean;
  generated: boolean;
}) {
  const completedCount = steps.filter((s) => s.status === 'done').length;
  const colorSet = accent === 'blue' ? STEP_ICON_COLORS : ROLLBACK_COLORS;
  const accentColor = accent === 'blue' ? '#0EA5E9' : '#EF4444';
  const accentSecondary = accent === 'blue' ? '#34D399' : '#FB923C';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <motion.button
          onClick={onGenerate}
          disabled={generating}
          whileHover={generating ? {} : { scale: 1.02 }}
          whileTap={generating ? {} : { scale: 0.97 }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 disabled:opacity-60"
          style={{
            background: generating ? `rgba(${accent === 'blue' ? '14,165,233' : '239,68,68'},0.15)` : `linear-gradient(135deg, ${accentColor} 0%, ${accentSecondary} 100%)`,
            color: '#fff',
            border: `1px solid rgba(${accent === 'blue' ? '14,165,233' : '239,68,68'},0.4)`,
            boxShadow: generating ? 'none' : `0 4px 16px rgba(${accent === 'blue' ? '14,165,233' : '239,68,68'},0.3)`,
          }}
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              {accent === 'blue' ? <Zap className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
              Generate {title}
            </>
          )}
        </motion.button>

        <AnimatePresence>
          {generated && !generating && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className={`flex items-center gap-1.5 text-sm font-medium ${accent === 'blue' ? 'text-emerald-400' : 'text-orange-400'}`}
            >
              <CheckCircle2 className="w-4 h-4" />
              Plan ready — {steps.length} steps
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {(generating || generated) && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <div className="flex justify-between text-xs text-text-muted mb-1.5">
              <span>Steps analysed</span>
              <span>{completedCount} / {steps.length}</span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <motion.div
                className="h-full rounded-full"
                animate={{ width: `${(completedCount / steps.length) * 100}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentSecondary})` }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timeline */}
      <div className="relative">
        <div
          className="absolute left-[22px] top-6 bottom-6 w-px"
          style={{ background: `linear-gradient(180deg, rgba(${accent === 'blue' ? '14,165,233' : '239,68,68'},0.3) 0%, rgba(${accent === 'blue' ? '14,165,233' : '239,68,68'},0.05) 100%)` }}
        />
        <ol className="space-y-0">
          {steps.map((step, i) => {
            const isLast = i === steps.length - 1;
            const isDone = step.status === 'done';
            const isActive = step.status === 'active';
            const cs = colorSet[i % colorSet.length];
            const Icon = step.icon;

            return (
              <motion.li
                key={step.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: i * 0.06 }}
                className={`relative flex gap-4 ${isLast ? '' : 'pb-5'}`}
              >
                <div className="shrink-0 flex flex-col items-center" style={{ width: 44 }}>
                  <motion.div
                    animate={isActive ? { scale: [1, 1.1, 1], boxShadow: [`0 0 0px ${accentColor}00`, `0 0 16px ${accentColor}80`, `0 0 0px ${accentColor}00`] } : {}}
                    transition={isActive ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : {}}
                    className="w-11 h-11 rounded-2xl flex items-center justify-center relative"
                    style={{
                      background: isDone
                        ? accent === 'blue' ? 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(5,150,105,0.1) 100%)' : 'linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(185,28,28,0.1) 100%)'
                        : isActive
                        ? `linear-gradient(135deg, rgba(${accent === 'blue' ? '14,165,233' : '239,68,68'},0.25) 0%, rgba(${accent === 'blue' ? '2,132,199' : '185,28,28'},0.15) 100%)`
                        : cs.bg,
                      border: isDone
                        ? accent === 'blue' ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(239,68,68,0.4)'
                        : isActive
                        ? `1px solid rgba(${accent === 'blue' ? '14,165,233' : '239,68,68'},0.5)`
                        : `1px solid ${cs.border}`,
                    }}
                  >
                    <AnimatePresence mode="wait">
                      {isDone ? (
                        <motion.span key="done" initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ duration: 0.25, type: 'spring', stiffness: 260, damping: 20 }}>
                          <CheckCircle2 className={`w-5 h-5 ${accent === 'blue' ? 'text-emerald-400' : 'text-red-400'}`} />
                        </motion.span>
                      ) : isActive ? (
                        <motion.span key="active" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                          <Loader2 className={`w-5 h-5 animate-spin ${accent === 'blue' ? 'text-sky-400' : 'text-red-400'}`} />
                        </motion.span>
                      ) : (
                        <motion.span key="idle" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                          <Icon className="w-5 h-5" style={{ color: cs.icon }} />
                        </motion.span>
                      )}
                    </AnimatePresence>
                    <span
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                      style={{
                        background: isDone ? (accent === 'blue' ? '#10B981' : '#EF4444') : isActive ? accentColor : 'rgba(255,255,255,0.1)',
                        color: isDone || isActive ? '#fff' : 'rgba(255,255,255,0.4)',
                        border: isDone ? `1px solid rgba(${accent === 'blue' ? '16,185,129' : '239,68,68'},0.5)` : isActive ? `1px solid rgba(${accent === 'blue' ? '14,165,233' : '239,68,68'},0.5)` : '1px solid rgba(255,255,255,0.1)',
                      }}
                    >
                      {step.id}
                    </span>
                  </motion.div>
                </div>

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
                          color: isDone ? (accent === 'blue' ? '#34D399' : '#F87171') : isActive ? (accent === 'blue' ? '#38BDF8' : '#F87171') : 'rgba(255,255,255,0.85)',
                        }}
                      >
                        {step.title}
                      </h3>
                      {step.qm && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}>
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
                          background: isDone ? `rgba(${accent === 'blue' ? '16,185,129' : '239,68,68'},0.12)` : isActive ? `rgba(${accent === 'blue' ? '14,165,233' : '239,68,68'},0.12)` : 'rgba(255,255,255,0.04)',
                          border: isDone ? `1px solid rgba(${accent === 'blue' ? '16,185,129' : '239,68,68'},0.3)` : isActive ? `1px solid rgba(${accent === 'blue' ? '14,165,233' : '239,68,68'},0.3)` : '1px solid rgba(255,255,255,0.08)',
                          color: isDone ? (accent === 'blue' ? '#34D399' : '#F87171') : isActive ? (accent === 'blue' ? '#38BDF8' : '#F87171') : 'rgba(255,255,255,0.3)',
                        }}
                      >
                        {isDone ? 'ready' : isActive ? 'planning…' : 'pending'}
                      </motion.span>
                    </div>
                  </div>
                  <p className="text-xs text-text-muted mt-1.5 leading-relaxed pr-2">{step.description}</p>
                </motion.div>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

export default function MigrationPlanningPage() {
  const navigate = useNavigate();
  const { sourceTopology, targetTopology } = useAppStore();

  const [migrationSteps, setMigrationSteps] = useState<PlanStep[]>([]);
  const [rollbackSteps, setRollbackSteps] = useState<PlanStep[]>([]);
  const [generatingMigration, setGeneratingMigration] = useState(false);
  const [generatedMigration, setGeneratedMigration] = useState(false);
  const [generatingRollback, setGeneratingRollback] = useState(false);
  const [generatedRollback, setGeneratedRollback] = useState(false);
  const [agentMessages, setAgentMessages] = useState<BubbleMsg[]>([]);
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentUnread, setAgentUnread] = useState(0);
  const msgIdRef = useRef(0);

  const pushMessage = useCallback((text: string) => {
    const id = ++msgIdRef.current;
    setAgentMessages((prev) => [...prev, { id, text }]);
    setAgentUnread((n) => n + 1);
  }, []);

  // Build migration steps from topology data
  const buildMigrationSteps = useCallback((): PlanStep[] => {
    if (!sourceTopology || !targetTopology) {
      return [
        { id: 1, title: 'Create Target Queue Managers', description: 'Provision dedicated queue managers on target cluster with TLS certificates and naming policy applied.', icon: Server, status: 'pending', qm: 'TGT.QM.*', duration: '~45s', type: 'migration' },
        { id: 2, title: 'Provision Queues', description: 'Define and provision all local queues on target QMs matching the source topology. Dead-letter queues (DLQ) created automatically.', icon: Database, status: 'pending', qm: 'All QMs', duration: '~20s', type: 'migration' },
        { id: 3, title: 'Establish Channels', description: 'Create sender/receiver channel pairs between source and target QMs. MCA credentials injected from sealed secrets.', icon: GitBranch, status: 'pending', qm: 'SRC → TGT', duration: '~30s', type: 'migration' },
        { id: 4, title: 'Convert Remote Queue Definitions', description: 'Reconfigure local queue definitions as remote queue aliases pointing to target. Zero message loss via in-flight tracking.', icon: ArrowRightLeft, status: 'pending', qm: 'SRC QMs', duration: '~15s', type: 'migration' },
        { id: 5, title: 'Route Traffic', description: 'Activate transmission queues and flip routing table. Run post-rewire validation to confirm message flow before finalising cutover.', icon: Route, status: 'pending', qm: 'All', duration: '~60s', type: 'migration' },
      ];
    }

    const sourceQMs = sourceTopology.nodes.filter((n) => n.type === 'qmNode');
    const targetQMs = targetTopology.nodes.filter((n) => n.type === 'qmNode');
    const channels = sourceTopology.nodes.filter((n) => n.type === 'channelNode');
    const sourceApps = sourceTopology.nodes.filter((n) => n.type === 'appNode');

    const steps: PlanStep[] = [];
    let stepId = 1;

    // Step per target QM creation
    targetQMs.slice(0, 2).forEach((qm) => {
      steps.push({
        id: stepId++,
        title: `Provision ${qm.label}`,
        description: `Create queue manager ${qm.label} on target cluster. Apply TLS certificates, naming policy, and MCA credentials from sealed secrets.`,
        icon: Server,
        status: 'pending',
        qm: qm.label,
        duration: '~45s',
        type: 'migration',
      });
    });

    if (targetQMs.length > 2) {
      steps.push({
        id: stepId++,
        title: `Provision ${targetQMs.length - 2} additional target QMs`,
        description: `Create ${targetQMs.length - 2} remaining target queue managers: ${targetQMs.slice(2).map((q) => q.label).join(', ')}.`,
        icon: Layers,
        status: 'pending',
        qm: `+${targetQMs.length - 2} QMs`,
        duration: `~${(targetQMs.length - 2) * 30}s`,
        type: 'migration',
      });
    }

    const totalQueues = sourceTopology.nodes.filter((n) => n.type === 'queueNode').length;
    if (totalQueues > 0) {
      steps.push({
        id: stepId++,
        title: `Provision ${totalQueues} queues on target`,
        description: `Define all local queues matching source topology on target QMs. Dead-letter queues created automatically per naming policy.`,
        icon: Database,
        status: 'pending',
        qm: 'All target QMs',
        duration: `~${Math.ceil(totalQueues / 5) * 10}s`,
        type: 'migration',
      });
    }

    if (channels.length > 0) {
      steps.push({
        id: stepId++,
        title: `Establish ${channels.length} channels`,
        description: `Create sender/receiver channel pairs: ${channels.slice(0, 3).map((c) => c.label).join(', ')}${channels.length > 3 ? ` and ${channels.length - 3} more` : ''}.`,
        icon: GitBranch,
        status: 'pending',
        qm: `${sourceQMs[0]?.label ?? 'SRC'} → ${targetQMs[0]?.label ?? 'TGT'}`,
        duration: `~${channels.length * 10}s`,
        type: 'migration',
      });
    }

    steps.push({
      id: stepId++,
      title: 'Convert to remote queue definitions',
      description: `Reconfigure ${sourceQMs.length} source QM${sourceQMs.length !== 1 ? 's' : ''} — convert local queues to remote aliases pointing to target. In-flight message tracking ensures zero loss.`,
      icon: ArrowRightLeft,
      status: 'pending',
      qm: sourceQMs.map((q) => q.label).join(', ') || 'SRC QMs',
      duration: '~15s',
      type: 'migration',
    });

    steps.push({
      id: stepId++,
      title: 'Activate transmission queues & validate',
      description: `Flip routing table on ${sourceApps.length} application${sourceApps.length !== 1 ? 's' : ''}. Run baseline, post-rewire, and final validation checks to confirm end-to-end message flow.`,
      icon: Route,
      status: 'pending',
      qm: 'All',
      duration: '~60s',
      type: 'migration',
    });

    return steps;
  }, [sourceTopology, targetTopology]);

  const buildRollbackSteps = useCallback((): PlanStep[] => {
    if (!sourceTopology || !targetTopology) {
      return [
        { id: 1, title: 'Halt traffic routing', description: 'Stop all transmission queues and halt message routing to target QMs. Suspend application connections.', icon: AlertTriangle, status: 'pending', duration: '~5s', type: 'rollback' },
        { id: 2, title: 'Restore local queue definitions', description: 'Convert remote queue aliases back to local queue definitions on source QMs. Restore original routing tables.', icon: RotateCcw, status: 'pending', duration: '~15s', type: 'rollback' },
        { id: 3, title: 'Flush in-flight messages', description: 'Drain transmission queues and ensure all in-flight messages are redelivered to source queues without loss.', icon: ArrowRight, status: 'pending', duration: '~20s', type: 'rollback' },
        { id: 4, title: 'Decommission target QMs', description: 'Stop and clean up target queue managers. Remove channel definitions and purge target queues safely.', icon: Shield, status: 'pending', duration: '~30s', type: 'rollback' },
        { id: 5, title: 'Validate rollback', description: 'Run post-rollback validation to confirm applications are connected to source QMs and message flow is restored.', icon: FileText, status: 'pending', duration: '~20s', type: 'rollback' },
      ];
    }

    const sourceQMs = sourceTopology.nodes.filter((n) => n.type === 'qmNode');
    const targetQMs = targetTopology.nodes.filter((n) => n.type === 'qmNode');
    const channels = sourceTopology.nodes.filter((n) => n.type === 'channelNode');

    return [
      {
        id: 1,
        title: 'Halt traffic routing',
        description: `Stop all ${channels.length} transmission queues. Suspend message routing to ${targetQMs.length} target QMs. Disconnect application bindings.`,
        icon: AlertTriangle,
        status: 'pending',
        qm: 'All channels',
        duration: '~5s',
        type: 'rollback',
      },
      {
        id: 2,
        title: 'Restore local queue definitions',
        description: `Revert remote queue aliases back to local definitions on ${sourceQMs.length} source QM${sourceQMs.length !== 1 ? 's' : ''}. Restore original routing tables to pre-migration state.`,
        icon: RotateCcw,
        status: 'pending',
        qm: sourceQMs.map((q) => q.label).slice(0, 2).join(', ') || 'SRC QMs',
        duration: '~15s',
        type: 'rollback',
      },
      {
        id: 3,
        title: 'Drain in-flight messages',
        description: `Flush all transmission queues. Redeliver in-flight messages back to source queues. Zero-loss delivery guaranteed via message tracking snapshots.`,
        icon: ArrowRight,
        status: 'pending',
        qm: 'XMIT queues',
        duration: '~20s',
        type: 'rollback',
      },
      {
        id: 4,
        title: `Decommission ${targetQMs.length} target QMs`,
        description: `Stop and clean up target queue managers: ${targetQMs.map((q) => q.label).slice(0, 3).join(', ')}${targetQMs.length > 3 ? ` +${targetQMs.length - 3} more` : ''}. Purge queues safely.`,
        icon: Shield,
        status: 'pending',
        qm: `${targetQMs.length} target QMs`,
        duration: `~${targetQMs.length * 10}s`,
        type: 'rollback',
      },
      {
        id: 5,
        title: 'Validate rollback complete',
        description: `Run post-rollback validation on all ${sourceQMs.length} source QMs. Confirm applications are reconnected and message flow is fully restored.`,
        icon: FileText,
        status: 'pending',
        qm: 'All source QMs',
        duration: '~20s',
        type: 'rollback',
      },
    ];
  }, [sourceTopology, targetTopology]);

  const MIGRATION_AGENT_MESSAGES = useCallback(() => {
    const src = sourceTopology;
    const tgt = targetTopology;
    if (!src || !tgt) {
      return [
        'Analysing source topology — reading queue manager configuration.',
        'Policy check passed — TLS and naming rules satisfied.',
        'Estimated total migration time: ~2m 50s.',
        'Optimised migration order generated — 5 sequential steps.',
        'No conflicting channels detected on target cluster.',
      ];
    }
    const srcQMs = src.nodes.filter((n) => n.type === 'qmNode');
    const queues = src.nodes.filter((n) => n.type === 'queueNode');
    const tgtQMs = tgt.nodes.filter((n) => n.type === 'qmNode');
    return [
      `Analysing source topology — found ${srcQMs.length} queue manager${srcQMs.length !== 1 ? 's' : ''}, ${queues.length} queue${queues.length !== 1 ? 's' : ''}.`,
      `Target topology verified — ${tgtQMs.length} target QM${tgtQMs.length !== 1 ? 's' : ''} ready for provisioning.`,
      'Policy check passed — TLS and naming rules satisfied for all QMs.',
      `Migration plan generated — ${buildMigrationSteps().length} sequential steps optimised for zero downtime.`,
      'No conflicting channels detected. Ready to execute migration.',
    ];
  }, [sourceTopology, targetTopology, buildMigrationSteps]);

  const ROLLBACK_AGENT_MESSAGES = useCallback(() => {
    const src = sourceTopology;
    if (!src) {
      return [
        'Generating rollback plan from current topology snapshot.',
        'Identified all reversible operations in migration sequence.',
        'Rollback order validated — no circular dependencies.',
        'Estimated rollback time: ~1m 30s.',
        'Rollback plan ready — all steps verified safe.',
      ];
    }
    const srcQMs = src.nodes.filter((n) => n.type === 'qmNode');
    const tgtQMs = targetTopology?.nodes.filter((n) => n.type === 'qmNode') ?? [];
    return [
      `Snapshot captured for ${srcQMs.length} source QM${srcQMs.length !== 1 ? 's' : ''} — rollback baseline recorded.`,
      `Identified ${tgtQMs.length} target QM${tgtQMs.length !== 1 ? 's' : ''} to decommission on rollback.`,
      'Rollback order validated — no circular dependencies detected.',
      `Estimated rollback time: ~${srcQMs.length * 30}s.`,
      'Rollback plan ready — all reversible operations verified safe.',
    ];
  }, [sourceTopology, targetTopology]);

  const handleGenerateMigration = async () => {
    if (generatingMigration) return;
    setGeneratingMigration(true);
    setGeneratedMigration(false);
    const steps = buildMigrationSteps().map((s) => ({ ...s, status: 'pending' as const }));
    setMigrationSteps(steps);

    const msgs = MIGRATION_AGENT_MESSAGES();
    msgs.forEach((msg, i) => {
      setTimeout(() => pushMessage(msg), i * 700 + 300);
    });

    for (let i = 0; i < steps.length; i++) {
      await new Promise((res) => setTimeout(res, 500 + i * 220));
      setMigrationSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, status: 'active' } : s)));
      await new Promise((res) => setTimeout(res, 600));
      setMigrationSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, status: 'done' } : s)));
    }

    setGeneratingMigration(false);
    setGeneratedMigration(true);
  };

  const handleGenerateRollback = async () => {
    if (generatingRollback) return;
    setGeneratingRollback(true);
    setGeneratedRollback(false);
    const steps = buildRollbackSteps().map((s) => ({ ...s, status: 'pending' as const }));
    setRollbackSteps(steps);

    const msgs = ROLLBACK_AGENT_MESSAGES();
    msgs.forEach((msg, i) => {
      setTimeout(() => pushMessage(msg), i * 700 + 300);
    });

    for (let i = 0; i < steps.length; i++) {
      await new Promise((res) => setTimeout(res, 500 + i * 220));
      setRollbackSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, status: 'active' } : s)));
      await new Promise((res) => setTimeout(res, 600));
      setRollbackSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, status: 'done' } : s)));
    }

    setGeneratingRollback(false);
    setGeneratedRollback(true);
  };

  const handleAgentOpen = (v: boolean) => {
    setAgentOpen(v);
    if (v) setAgentUnread(0);
  };

  const hasTopologyData = !!sourceTopology && !!targetTopology;
  const sourceQMCount = sourceTopology?.nodes.filter((n) => n.type === 'qmNode').length ?? 0;
  const targetQMCount = targetTopology?.nodes.filter((n) => n.type === 'qmNode').length ?? 0;
  const totalNodes = (sourceTopology?.nodes.length ?? 0) + (targetTopology?.nodes.length ?? 0);

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-text-secondary" />
          <h1 className="text-xl font-semibold text-text-primary">Migration Planning</h1>
        </div>
        {generatedMigration && generatedRollback && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => navigate('/migration-simulation')}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{
              background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
              boxShadow: '0 4px 16px rgba(22,163,74,0.3)',
              border: '1px solid rgba(22,163,74,0.4)',
            }}
          >
            <PlayCircle className="w-4 h-4" />
            Run Migration Simulation
          </motion.button>
        )}
      </div>

      {/* Topology summary */}
      {hasTopologyData ? (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl px-5 py-4 flex items-start gap-4"
          style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.08) 0%, rgba(2,132,199,0.04) 100%)', border: '1px solid rgba(14,165,233,0.2)', boxShadow: '0 2px 12px rgba(14,165,233,0.06)' }}
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.2) 0%, rgba(2,132,199,0.1) 100%)', border: '1px solid rgba(14,165,233,0.3)' }}>
            <Brain className="w-4 h-4 text-sky-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-sky-300">Topology Loaded</span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.25)', color: '#7DD3FC' }}>
                Real Data
              </span>
            </div>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <span className="text-xs text-text-secondary flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                {sourceQMCount} source QM{sourceQMCount !== 1 ? 's' : ''}
              </span>
              <span className="text-xs text-text-secondary flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {targetQMCount} target QM{targetQMCount !== 1 ? 's' : ''}
              </span>
              <span className="text-xs text-text-secondary flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                {totalNodes} total nodes
              </span>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl px-5 py-4 flex items-start gap-4"
          style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}
        >
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-300">No topology data — using default plan</p>
            <p className="text-xs text-text-muted mt-0.5">Upload source and target topologies in the Topology tab for a data-driven plan.</p>
          </div>
        </motion.div>
      )}

      {/* Two-column plans */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Migration Plan */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-surface-border">
            <div className="w-7 h-7 rounded-lg bg-blue-900/40 border border-blue-700/40 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <h2 className="text-base font-bold text-text-primary">Migration Plan</h2>
            {generatedMigration && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/30 border border-emerald-700/40 text-emerald-300 font-medium ml-auto">
                Ready
              </span>
            )}
          </div>
          <PlanTimeline
            steps={migrationSteps.length > 0 ? migrationSteps : buildMigrationSteps()}
            title="Migration Plan"
            accent="blue"
            onGenerate={handleGenerateMigration}
            generating={generatingMigration}
            generated={generatedMigration}
          />
        </div>

        {/* Rollback Plan */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-surface-border">
            <div className="w-7 h-7 rounded-lg bg-red-900/40 border border-red-700/40 flex items-center justify-center">
              <RotateCcw className="w-3.5 h-3.5 text-red-400" />
            </div>
            <h2 className="text-base font-bold text-text-primary">Rollback Plan</h2>
            {generatedRollback && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-900/30 border border-red-700/40 text-red-300 font-medium ml-auto">
                Ready
              </span>
            )}
          </div>
          <PlanTimeline
            steps={rollbackSteps.length > 0 ? rollbackSteps : buildRollbackSteps()}
            title="Rollback Plan"
            accent="red"
            onGenerate={handleGenerateRollback}
            generating={generatingRollback}
            generated={generatedRollback}
          />
        </div>
      </div>

      {/* Floating agent */}
      <AgentBubble messages={agentMessages} open={agentOpen} setOpen={handleAgentOpen} unread={agentUnread} />
    </div>
  );
}
