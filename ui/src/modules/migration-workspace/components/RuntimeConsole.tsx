import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Download } from 'lucide-react';
import { format } from 'date-fns';
import { useWorkspaceStore } from '../store/workspaceStore';
import type { RuntimeLogEntry } from '../types';

const LEVEL_STYLE: Record<RuntimeLogEntry['level'], { color: string; bg: string }> = {
  INFO:    { color: '#9ca3af', bg: 'transparent' },
  WARNING: { color: '#f59e0b', bg: 'rgba(245,158,11,0.05)' },
  ERROR:   { color: '#ef4444', bg: 'rgba(239,68,68,0.05)' },
  SUCCESS: { color: '#22c55e', bg: 'rgba(34,197,94,0.05)' },
};

const LEVEL_LABEL: Record<RuntimeLogEntry['level'], string> = {
  INFO:    'INFO',
  WARNING: 'WARN',
  ERROR:   'ERR ',
  SUCCESS: 'SUCC',
};

function LogRow({ entry }: { entry: RuntimeLogEntry }) {
  const s = LEVEL_STYLE[entry.level];
  return (
    <div
      className="flex items-start gap-2 px-3 py-1 font-mono text-[11px] leading-relaxed hover:bg-surface-overlay/40 transition-colors"
      style={{ background: s.bg }}
    >
      <span className="text-text-muted shrink-0 tabular-nums">
        {format(entry.timestamp, 'HH:mm:ss')}
      </span>
      <span className="shrink-0 font-semibold w-9" style={{ color: s.color }}>
        {LEVEL_LABEL[entry.level]}
      </span>
      <span className="shrink-0 text-[#818cf8] min-w-[100px]">{entry.service}</span>
      <span className="text-text-secondary">{entry.message}</span>
    </div>
  );
}

export default function RuntimeConsole() {
  const { runtimeLogs } = useWorkspaceStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [runtimeLogs.length]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-border">
        <Terminal className="w-3.5 h-3.5 text-text-muted" />
        <span className="text-xs font-semibold text-text-primary">Runtime Logs</span>
        <span className="text-[11px] text-text-muted ml-auto">{runtimeLogs.length} entries</span>
        <button className="btn-ghost text-[11px] py-0.5 px-2">
          <Download className="w-3 h-3" />
        </button>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[11px] text-green-400">Auto Scroll</span>
        </div>
      </div>

      {/* Log stream */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ background: 'rgba(0,0,0,0.3)', fontFamily: "'JetBrains Mono', monospace" }}
      >
        <AnimatePresence initial={false}>
          {runtimeLogs.map((entry, i) => (
            <motion.div
              key={`${entry.timestamp}-${i}`}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15 }}
            >
              <LogRow entry={entry} />
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
