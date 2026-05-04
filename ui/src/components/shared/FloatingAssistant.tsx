import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { X, ChevronDown, Cpu } from 'lucide-react';

export interface AssistantMessage {
  id: string;
  text: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

interface Props {
  messages: AssistantMessage[];
}

// ── Typing cursor effect ──────────────────────────────────────────────────────
function TypingText({ text, onDone }: { text: string; onDone?: () => void }) {
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
        onDone?.();
      }
    }, 18);
    return () => clearInterval(iv);
  }, [text, onDone]);

  return (
    <span>
      {displayed}
      {!done && (
        <span
          className="inline-block w-[2px] h-3 ml-0.5 align-middle rounded-full"
          style={{ background: 'currentColor', animation: 'blink 0.7s step-end infinite' }}
        />
      )}
    </span>
  );
}

// ── Message type tokens ───────────────────────────────────────────────────────
const TYPE = {
  info:    { text: 'text-sky-200',   dot: '#38BDF8', bg: 'rgba(56,189,248,0.07)'  },
  success: { text: 'text-emerald-300', dot: '#34D399', bg: 'rgba(52,211,153,0.07)' },
  warning: { text: 'text-amber-300', dot: '#FBBF24', bg: 'rgba(251,191,36,0.07)'  },
  error:   { text: 'text-red-300',   dot: '#F87171', bg: 'rgba(248,113,113,0.07)' },
} satisfies Record<AssistantMessage['type'], { text: string; dot: string; bg: string }>;

// ── Avatar with gradient ring + glow ─────────────────────────────────────────
function Avatar({ open, hasUnread }: { open: boolean; hasUnread: boolean }) {
  return (
    // Outer gradient ring
    <div
      className="relative w-14 h-14 rounded-full p-[2px]"
      style={{
        background: open
          ? 'linear-gradient(135deg, #06B6D4, #0EA5E9, #3B82F6)'
          : 'linear-gradient(135deg, #0EA5E9, #06B6D4, #22D3EE)',
        boxShadow: open
          ? '0 0 0 4px rgba(6,182,212,0.15), 0 0 24px rgba(6,182,212,0.35), 0 8px 24px rgba(0,0,0,0.5)'
          : '0 0 0 4px rgba(14,165,233,0.12), 0 0 18px rgba(14,165,233,0.25), 0 6px 20px rgba(0,0,0,0.4)',
      }}
    >
      {/* Inner circle */}
      <div
        className="w-full h-full rounded-full flex items-center justify-center overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, #0C1A2E 0%, #0A1628 60%, #071120 100%)',
        }}
      >
        {open ? (
          <X className="w-5 h-5 text-sky-300" />
        ) : (
          <Cpu className="w-5 h-5 text-sky-400" />
        )}
      </div>

      {/* Unread badge */}
      <AnimatePresence>
        {hasUnread && !open && (
          <motion.span
            key="badge"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1"
            style={{ background: '#22C55E', boxShadow: '0 0 8px rgba(34,197,94,0.7)' }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FloatingAssistant({ messages }: Props) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const prevLenRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track new messages
  useEffect(() => {
    if (messages.length > prevLenRef.current) {
      if (!open) setUnread((n) => n + (messages.length - prevLenRef.current));
      prevLenRef.current = messages.length;
    }
  }, [messages.length, open]);

  // Auto-scroll on open / new messages
  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 80);
    }
  }, [open, messages.length]);

  const lastMsg = messages[messages.length - 1];

  // Subtle floating y offset using a spring
  const floatY = useMotionValue(0);
  const springY = useSpring(floatY, { stiffness: 60, damping: 12 });

  useEffect(() => {
    let dir = 1;
    const iv = setInterval(() => {
      floatY.set(dir * 5);
      dir *= -1;
    }, 2200);
    return () => clearInterval(iv);
  }, [floatY]);

  return (
    <>
      {/* Blink keyframe */}
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>

      <motion.div
        className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2.5"
        style={{ y: springY }}
      >
        {/* Collapsed preview tooltip */}
        <AnimatePresence>
          {!open && lastMsg && (
            <motion.div
              key={lastMsg.id}
              initial={{ opacity: 0, y: 8, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.94 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => setOpen(true)}
              className="cursor-pointer max-w-[240px] rounded-2xl rounded-br-sm px-3.5 py-2.5"
              style={{
                background: 'rgba(10,18,32,0.92)',
                border: '1px solid rgba(14,165,233,0.2)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.45), 0 0 12px rgba(14,165,233,0.08)',
                backdropFilter: 'blur(14px)',
              }}
            >
              <div className="flex items-start gap-2">
                <span
                  className="mt-1 w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: TYPE[lastMsg.type].dot, boxShadow: `0 0 5px ${TYPE[lastMsg.type].dot}` }}
                />
                <p className={`text-xs leading-relaxed font-medium ${TYPE[lastMsg.type].text}`}>
                  {lastMsg.text}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expanded chat panel */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.94 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col overflow-hidden"
              style={{
                width: '300px',
                maxHeight: '420px',
                background: 'rgba(8,16,30,0.96)',
                border: '1px solid rgba(14,165,233,0.22)',
                borderRadius: '20px',
                boxShadow:
                  '0 24px 48px rgba(0,0,0,0.6), 0 8px 16px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)',
                backdropFilter: 'blur(20px)',
              }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-4 py-3 shrink-0"
                style={{
                  borderBottom: '1px solid rgba(14,165,233,0.14)',
                  background: 'rgba(6,12,24,0.6)',
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, rgba(6,182,212,0.2) 0%, rgba(14,165,233,0.1) 100%)',
                      border: '1px solid rgba(6,182,212,0.35)',
                      boxShadow: '0 0 10px rgba(6,182,212,0.2)',
                    }}
                  >
                    <Cpu className="w-3.5 h-3.5 text-sky-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white leading-none">Migration Agent</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: '#34D399', boxShadow: '0 0 5px rgba(52,211,153,0.8)' }}
                      />
                      <span className="text-[10px] text-sky-400/70 font-medium tracking-wide">Active</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              {/* Messages */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0"
                style={{ scrollbarWidth: 'none' }}
              >
                {messages.length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-8">Waiting for activity…</p>
                )}
                {messages.map((msg, i) => {
                  const t = TYPE[msg.type];
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, x: -8, y: 4 }}
                      animate={{ opacity: 1, x: 0, y: 0 }}
                      transition={{ duration: 0.22 }}
                      className="flex gap-2 rounded-xl px-3 py-2"
                      style={{ background: t.bg }}
                    >
                      <span
                        className="mt-[6px] w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: t.dot, boxShadow: `0 0 5px ${t.dot}` }}
                      />
                      <p className={`text-xs leading-relaxed ${t.text}`}>
                        {i === messages.length - 1 ? (
                          <TypingText
                            text={msg.text}
                            onDone={() => {
                              scrollRef.current?.scrollTo({
                                top: scrollRef.current.scrollHeight,
                                behavior: 'smooth',
                              });
                            }}
                          />
                        ) : (
                          msg.text
                        )}
                      </p>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FAB — circular avatar button */}
        <motion.button
          onClick={() => setOpen((v) => !v)}
          whileHover={{ scale: 1.07 }}
          whileTap={{ scale: 0.93 }}
          className="relative focus:outline-none"
          aria-label="Toggle AI assistant"
        >
          {/* Idle pulse ring — only when closed */}
          {!open && (
            <>
              <motion.span
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'transparent',
                  border: '2px solid rgba(14,165,233,0.5)',
                }}
                animate={{ scale: [1, 1.55], opacity: [0.5, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
              />
              <motion.span
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'transparent',
                  border: '2px solid rgba(6,182,212,0.35)',
                }}
                animate={{ scale: [1, 1.85], opacity: [0.35, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
              />
            </>
          )}

          <Avatar open={open} hasUnread={unread > 0} />

          {/* Unread dot */}
          <AnimatePresence>
            {unread > 0 && !open && (
              <motion.span
                key="dot"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1"
                style={{ background: '#22C55E', boxShadow: '0 0 8px rgba(34,197,94,0.7)' }}
              >
                {unread}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </motion.div>
    </>
  );
}
