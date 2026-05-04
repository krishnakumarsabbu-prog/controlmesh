import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, ChevronDown } from 'lucide-react';

export interface AssistantMessage {
  id: string;
  text: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

interface Props {
  messages: AssistantMessage[];
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
    }, 16);
    return () => clearInterval(interval);
  }, [text, onDone]);

  return (
    <span>
      {displayed}
      {!done && (
        <span className="inline-block w-0.5 h-3 ml-0.5 align-middle animate-pulse" style={{ background: 'currentColor' }} />
      )}
    </span>
  );
}

const TYPE_STYLES: Record<AssistantMessage['type'], { text: string; dot: string; bg: string }> = {
  info:    { text: 'text-text-primary',  dot: '#6366F1', bg: 'rgba(99,102,241,0.08)'   },
  success: { text: 'text-green-300',     dot: '#22C55E', bg: 'rgba(34,197,94,0.08)'    },
  warning: { text: 'text-amber-300',     dot: '#F59E0B', bg: 'rgba(245,158,11,0.08)'   },
  error:   { text: 'text-red-300',       dot: '#EF4444', bg: 'rgba(239,68,68,0.08)'    },
};

export default function FloatingAssistant({ messages }: Props) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const prevLenRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length > prevLenRef.current) {
      if (!open) setUnread((n) => n + (messages.length - prevLenRef.current));
      prevLenRef.current = messages.length;
    }
  }, [messages.length, open]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 80);
    }
  }, [open, messages.length]);

  const lastMessage = messages[messages.length - 1];

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {/* Collapsed preview bubble */}
      <AnimatePresence>
        {!open && lastMessage && (
          <motion.div
            key={lastMessage.id}
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(true)}
            className="cursor-pointer max-w-[240px] rounded-2xl rounded-br-sm px-3.5 py-2.5"
            style={{
              background: '#141B2D',
              border: '1px solid #1E2A3D',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div className="flex items-start gap-2">
              <span
                className="mt-1 w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: TYPE_STYLES[lastMessage.type].dot }}
              />
              <p className={`text-xs leading-relaxed font-medium ${TYPE_STYLES[lastMessage.type].text}`}>
                {lastMessage.text}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="w-76 rounded-2xl overflow-hidden flex flex-col"
            style={{
              width: '300px',
              maxHeight: '400px',
              background: '#141B2D',
              border: '1px solid #1E2A3D',
              boxShadow: '0 24px 48px rgba(0,0,0,0.5), 0 8px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
              backdropFilter: 'blur(16px)',
            }}
          >
            {/* Panel header */}
            <div
              className="flex items-center justify-between px-4 py-3 shrink-0"
              style={{
                borderBottom: '1px solid #1E2A3D',
                background: 'rgba(10,14,26,0.5)',
              }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(79,70,229,0.1) 100%)',
                    border: '1px solid rgba(99,102,241,0.3)',
                  }}
                >
                  <Bot className="w-3.5 h-3.5" style={{ color: '#818CF8' }} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-text-primary leading-none">Migration Agent</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: '#22C55E', boxShadow: '0 0 4px rgba(34,197,94,0.7)' }}
                    />
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

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0"
            >
              {messages.length === 0 && (
                <p className="text-xs text-text-muted text-center py-6">Waiting for activity…</p>
              )}
              {messages.map((msg, i) => {
                const style = TYPE_STYLES[msg.type];
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex gap-2 rounded-lg px-2.5 py-2"
                    style={{ background: style.bg }}
                  >
                    <span
                      className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: style.dot, boxShadow: `0 0 4px ${style.dot}` }}
                    />
                    <p className={`text-xs leading-relaxed ${style.text}`}>
                      {i === messages.length - 1 ? (
                        <TypingText
                          text={msg.text}
                          onDone={() => {
                            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
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

      {/* FAB button */}
      <motion.button
        onClick={() => setOpen((v) => !v)}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className="relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200"
        style={{
          background: open
            ? 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)'
            : 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
          boxShadow: '0 4px 16px rgba(99,102,241,0.4), 0 2px 4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
          border: '1px solid rgba(129,140,248,0.3)',
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

        {unread > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
            style={{ background: '#22C55E', boxShadow: '0 0 8px rgba(34,197,94,0.6)' }}
          >
            {unread}
          </motion.span>
        )}
      </motion.button>
    </div>
  );
}
