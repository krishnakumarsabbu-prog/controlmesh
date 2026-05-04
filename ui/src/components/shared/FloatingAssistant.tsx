import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, BrainCircuit, Send } from 'lucide-react';

export interface AssistantMessage {
  id: string;
  text: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

// ── Typing cursor ─────────────────────────────────────────────────────────────
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
    }, 22);
    return () => clearInterval(iv);
  }, [text, onDone]);

  return (
    <span>
      {displayed}
      {!done && (
        <span
          className="inline-block w-[2px] h-3 ml-0.5 align-middle rounded-sm"
          style={{ background: 'currentColor', animation: 'fa-blink 0.65s step-end infinite' }}
        />
      )}
    </span>
  );
}

// ── Message style tokens ──────────────────────────────────────────────────────
const MSG_STYLE = {
  info:    { text: 'text-sky-200',    dot: '#38BDF8', bg: 'rgba(56,189,248,0.07)'  },
  success: { text: 'text-emerald-300',dot: '#34D399', bg: 'rgba(52,211,153,0.08)'  },
  warning: { text: 'text-amber-300',  dot: '#FBBF24', bg: 'rgba(251,191,36,0.07)'  },
  error:   { text: 'text-red-300',    dot: '#F87171', bg: 'rgba(248,113,113,0.07)' },
} satisfies Record<AssistantMessage['type'], { text: string; dot: string; bg: string }>;

interface Props {
  messages: AssistantMessage[];
  onUserMessage: (text: string) => void;
  isProcessing?: boolean;
}

export default function FloatingAssistant({ messages, onUserMessage, isProcessing }: Props) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const prevLenRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Unread counter
  useEffect(() => {
    if (messages.length > prevLenRef.current) {
      if (!open) setUnread((n) => n + (messages.length - prevLenRef.current));
      prevLenRef.current = messages.length;
    }
  }, [messages.length, open]);

  // Clear unread + scroll on open
  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);
    }
  }, [open, messages.length]);

  const lastMsg = messages[messages.length - 1];

  return (
    <>
      <style>{`
        @keyframes fa-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fa-float {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-7px); }
        }
        .fa-float { animation: fa-float 3.6s ease-in-out infinite; }
        @keyframes fa-pulse-ring {
          0%   { transform: scale(1);    opacity: 0.6; }
          100% { transform: scale(1.75); opacity: 0;   }
        }
        .fa-ring-1 { animation: fa-pulse-ring 2s ease-out infinite; }
        .fa-ring-2 { animation: fa-pulse-ring 2s ease-out infinite 0.6s; }
      `}</style>

      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-3">

        {/* Collapsed preview bubble */}
        <AnimatePresence mode="wait">
          {!open && lastMsg && (
            <motion.div
              key={lastMsg.id}
              initial={{ opacity: 0, y: 10, scale: 0.92 }}
              animate={{ opacity: 1, y: 0,  scale: 1    }}
              exit={{ opacity: 0,    y: 6,  scale: 0.92 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => setOpen(true)}
              className="cursor-pointer max-w-[220px] rounded-2xl rounded-br-sm px-3.5 py-2.5 select-none"
              style={{
                background: 'rgba(8,15,30,0.95)',
                border: `1px solid ${MSG_STYLE[lastMsg.type].dot}40`,
                boxShadow: `0 8px 28px rgba(0,0,0,0.5), 0 0 16px ${MSG_STYLE[lastMsg.type].dot}18`,
                backdropFilter: 'blur(16px)',
              }}
            >
              <div className="flex items-start gap-2">
                <span
                  className="mt-[5px] w-1.5 h-1.5 rounded-full shrink-0"
                  style={{
                    background: MSG_STYLE[lastMsg.type].dot,
                    boxShadow: `0 0 6px ${MSG_STYLE[lastMsg.type].dot}`,
                  }}
                />
                <p className={`text-[11px] leading-relaxed font-medium ${MSG_STYLE[lastMsg.type].text}`}>
                  <TypingText key={lastMsg.id} text={lastMsg.text} />
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expanded chat panel */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.93 }}
              animate={{ opacity: 1, y: 0,  scale: 1    }}
              exit={{ opacity: 0,    y: 20, scale: 0.93 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col overflow-hidden"
              style={{
                width: '310px',
                maxHeight: '430px',
                background: 'rgba(6,12,24,0.97)',
                border: '1px solid rgba(14,165,233,0.25)',
                borderRadius: '22px',
                boxShadow:
                  '0 28px 56px rgba(0,0,0,0.65), 0 8px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
                backdropFilter: 'blur(24px)',
              }}
            >
              {/* Panel header */}
              <div
                className="flex items-center justify-between px-4 py-3.5 shrink-0"
                style={{
                  borderBottom: '1px solid rgba(14,165,233,0.12)',
                  background: 'rgba(4,10,20,0.7)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: 'linear-gradient(135deg, rgba(14,165,233,0.25) 0%, rgba(6,182,212,0.15) 100%)',
                      border: '1px solid rgba(14,165,233,0.4)',
                      boxShadow: '0 0 12px rgba(14,165,233,0.25)',
                    }}
                  >
                    <BrainCircuit className="w-4 h-4 text-sky-400" />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-white leading-none">Migration Agent</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: '#34D399', boxShadow: '0 0 5px rgba(52,211,153,0.9)' }}
                      />
                      <span className="text-[10px] font-medium tracking-wide" style={{ color: 'rgba(52,211,153,0.8)' }}>
                        Active
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-full transition-colors"
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#94A3B8' }}
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              {/* Message list */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5 min-h-0"
                style={{ scrollbarWidth: 'none' }}
              >
                {messages.length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-10">Waiting for activity…</p>
                )}
                {messages.map((msg, i) => {
                  const s = MSG_STYLE[msg.type];
                  const isLast = i === messages.length - 1;
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, x: -10, y: 4 }}
                      animate={{ opacity: 1,  x: 0,   y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex gap-2 rounded-xl px-3 py-2"
                      style={{ background: s.bg }}
                    >
                      <span
                        className="mt-[6px] w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: s.dot, boxShadow: `0 0 5px ${s.dot}` }}
                      />
                      <p className={`text-[11px] leading-relaxed ${s.text}`}>
                        {isLast
                          ? <TypingText key={msg.id} text={msg.text} onDone={() => {
                              scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
                            }} />
                          : msg.text
                        }
                      </p>
                    </motion.div>
                  );
                })}
                {isProcessing && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex gap-2 rounded-xl px-3 py-2 bg-sky-500/5"
                  >
                    <span className="mt-[6px] w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse shadow-[0_0_5px_#38BDF8]" />
                    <p className="text-[11px] text-sky-400 italic">Thinking...</p>
                  </motion.div>
                )}
              </div>

              {/* Input Area */}
              <div className="px-3 pb-3 pt-1 border-t border-white/5 bg-black/20">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!inputValue.trim() || isProcessing) return;
                    onUserMessage(inputValue);
                    setInputValue('');
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Ask assistant or give command..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-[11px] text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50 transition-colors"
                    disabled={isProcessing}
                  />
                  <button
                    type="submit"
                    disabled={!inputValue.trim() || isProcessing}
                    className="p-1.5 rounded-lg bg-sky-600 text-white disabled:opacity-50 hover:bg-sky-500 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FAB */}
        <div className={!open ? 'fa-float' : ''}>
          <motion.button
            onClick={() => setOpen((v) => !v)}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            className="relative focus:outline-none"
            aria-label="Toggle AI assistant"
          >
            {!open && (
              <>
                <span
                  className="fa-ring-1 absolute inset-0 rounded-full pointer-events-none"
                  style={{ border: '2px solid rgba(14,165,233,0.55)' }}
                />
                <span
                  className="fa-ring-2 absolute inset-0 rounded-full pointer-events-none"
                  style={{ border: '2px solid rgba(6,182,212,0.35)' }}
                />
              </>
            )}

            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{
                background: open
                  ? 'linear-gradient(135deg, #0EA5E9, #06B6D4, #22D3EE)'
                  : 'linear-gradient(135deg, #0EA5E9, #06B6D4, #67E8F9)',
                padding: '2.5px',
                boxShadow: open
                  ? '0 0 0 4px rgba(6,182,212,0.15), 0 0 28px rgba(14,165,233,0.45), 0 8px 24px rgba(0,0,0,0.55)'
                  : '0 0 0 3px rgba(14,165,233,0.1), 0 0 20px rgba(14,165,233,0.3), 0 6px 20px rgba(0,0,0,0.45)',
              }}
            >
              <div
                className="w-full h-full rounded-full flex items-center justify-center overflow-hidden"
                style={{
                  background: 'linear-gradient(150deg, #0C1D35 0%, #071628 55%, #050E1E 100%)',
                }}
              >
                <AnimatePresence mode="wait">
                  {open ? (
                    <motion.div
                      key="close"
                      initial={{ scale: 0, rotate: -90 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0, rotate: 90 }}
                      transition={{ duration: 0.18 }}
                    >
                      <X className="w-5 h-5 text-sky-300" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="brain"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ duration: 0.18 }}
                    >
                      <BrainCircuit className="w-5 h-5 text-sky-400" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <AnimatePresence>
              {unread > 0 && !open && (
                <motion.span
                  key="badge"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-1 -right-1 min-w-[20px] h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1"
                  style={{ background: '#22C55E', boxShadow: '0 0 10px rgba(34,197,94,0.8)' }}
                >
                  {unread}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>

      </div>
    </>
  );
}
