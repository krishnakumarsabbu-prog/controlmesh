import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, User } from 'lucide-react';
import type { MigrationRecord } from '../../types';

interface ChatMessage {
  role: 'assistant' | 'user';
  text: string;
}

interface Props {
  app: { id: string; source: string; target: string };
  record: MigrationRecord | undefined;
}

function buildExplanation(app: Props['app'], record: MigrationRecord | undefined): ChatMessage[] {
  const { id, source, target } = app;
  const state = record?.state ?? 'IDLE';

  const messages: ChatMessage[] = [
    {
      role: 'user',
      text: `What is this migration doing?`,
    },
    {
      role: 'assistant',
      text: `We are moving the message queues owned by **${id}** from the source queue manager **${source}** to a new target queue manager **${target}** — without any application-side code changes.`,
    },
    {
      role: 'assistant',
      text: `To do this safely, we use **remote routing**: instead of deleting queues on ${source} immediately, we install transparent forwarding definitions (a remote queue and an xmit queue) that silently redirect every message to ${target}. Producers keep writing to the same queue name on ${source} and the messages automatically arrive on ${target}.`,
    },
    {
      role: 'assistant',
      text: `The process follows these stages:\n1. **Baseline validation** — confirm queues on ${source} are healthy before touching anything.\n2. **Snapshot** — capture the current topology so we can roll back exactly if something goes wrong.\n3. **Provision target** — create the destination queue manager ${target} with all required queues, channels, and a dead-letter queue.\n4. **Rewire** — install remote routing on ${source} pointing to ${target}.\n5. **Post-rewire validation** — send test messages end-to-end to confirm transparent routing works.\n6. **Cutover** — remove the original local queue from ${source}, completing ownership transfer.\n7. **Final validation** — verify the application operates normally on ${target}.`,
    },
  ];

  if (state === 'ROLLING_BACK' || state === 'ROLLED_BACK') {
    messages.push({
      role: 'assistant',
      text: `A problem was detected during the migration${record?.error ? ` — "${record.error}"` : ''}. The system is automatically restoring the topology from the pre-migration snapshot: removing remote routing definitions, stopping channels, and recreating the original local queues on ${source}. No data is lost.`,
    });
  } else if (state === 'MIGRATED') {
    messages.push({
      role: 'assistant',
      text: `The migration is complete. ${id} is now fully operational on ${target}. The original queue definitions on ${source} have been removed and all message traffic flows natively through ${target}.`,
    });
  }

  return messages;
}

function parseInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function renderText(text: string) {
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = (key: string) => {
    if (listItems.length) {
      result.push(
        <ol key={`list-${key}`} className="list-decimal list-inside space-y-0.5 mt-1">
          {listItems.map((item, i) => (
            <li key={i} className="text-slate-700">{parseInline(item)}</li>
          ))}
        </ol>
      );
      listItems = [];
    }
  };

  lines.forEach((line, i) => {
    const numbered = line.match(/^(\d+)\.\s+(.*)/);
    if (numbered) {
      listItems.push(numbered[2]);
    } else {
      flushList(String(i));
      if (line.trim()) {
        result.push(<p key={i} className="text-slate-700 leading-relaxed">{parseInline(line)}</p>);
      }
    }
  });
  flushList('end');

  return result;
}

export default function ExplainPanel({ app, record }: Props) {
  const messages = buildExplanation(app, record);
  const [visible, setVisible] = useState<number>(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisible(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    messages.forEach((_, i) => {
      timers.push(setTimeout(() => setVisible(i + 1), i * 420 + 150));
    });
    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.id, record?.state]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [visible]);

  return (
    <div className="px-4 py-4 space-y-3 max-h-96 overflow-y-auto">
      <AnimatePresence initial={false}>
        {messages.slice(0, visible).map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                msg.role === 'assistant'
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {msg.role === 'assistant' ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
            </div>
            <div
              className={`rounded-2xl px-3.5 py-2.5 text-sm max-w-[85%] space-y-1 ${
                msg.role === 'assistant'
                  ? 'bg-slate-50 border border-slate-100 rounded-tl-sm'
                  : 'bg-slate-900 text-white rounded-tr-sm'
              }`}
            >
              {msg.role === 'user' ? (
                <p className="text-white">{msg.text}</p>
              ) : (
                renderText(msg.text)
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      <div ref={bottomRef} />
    </div>
  );
}
