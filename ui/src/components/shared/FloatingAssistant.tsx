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
    }, 18);
    return () => clearInterval(interval);
  }, [text, onDone]);

  return (
    <span>
      {displayed}
      {!done && (
        <span className="inline-block w-0.5 h-3.5 bg-current ml-0.5 align-middle animate-pulse" />
      )}
    </span>
  );
}

const TYPE_STYLES: Record<AssistantMessage['type'], string> = {
  info:    'text-slate-200',
  success: 'text-emerald-300',
  warning: 'text-amber-300',
  error:   'text-red-300',
};

const DOT_STYLES: Record<AssistantMessage['type'], string> = {
  info:    'bg-sky-400',
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  error:   'bg-red-400',
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
            className="cursor-pointer max-w-[220px] bg-slate-900 border border-slate-700 rounded-2xl rounded-br-sm px-3 py-2 shadow-xl"
          >
            <p className={`text-xs leading-relaxed font-medium ${TYPE_STYLES[lastMessage.type]}`}>
              {lastMessage.text}
            </p>
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
            className="w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: '380px' }}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-sky-500/20 flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5 text-sky-400" />
                </div>
                <span className="text-sm font-semibold text-slate-200">Migration Agent</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0"
            >
              {messages.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-4">Waiting for activity…</p>
              )}
              {messages.map((msg, i) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex gap-2"
                >
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${DOT_STYLES[msg.type]}`} />
                  <p className={`text-xs leading-relaxed ${TYPE_STYLES[msg.type]}`}>
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
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB button */}
      <motion.button
        onClick={() => setOpen((v) => !v)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="relative w-12 h-12 rounded-full bg-slate-900 border border-slate-700 shadow-xl flex items-center justify-center hover:bg-slate-800 transition-colors"
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.span key="close" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}>
              <X className="w-5 h-5 text-slate-300" />
            </motion.span>
          ) : (
            <motion.span key="bot" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
              <Bot className="w-5 h-5 text-sky-400" />
            </motion.span>
          )}
        </AnimatePresence>
        {unread > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-sky-500 text-white text-[10px] font-bold flex items-center justify-center"
          >
            {unread}
          </motion.span>
        )}
      </motion.button>
    </div>
  );
}
