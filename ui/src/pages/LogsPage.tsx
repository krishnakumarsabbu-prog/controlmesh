import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { Terminal, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, Circle as XCircle, Info, RefreshCw, ChevronDown, ChevronsDown, Activity, Circle } from 'lucide-react';
import { useLogs } from '../hooks/useLogs';
import type { LogEntry, LogLevel } from '../types';

// ── Level config ──────────────────────────────────────────────────────────────

const LEVEL_CONFIG: Record<
  LogLevel,
  { icon: React.ElementType; glyph: string; color: string; dim: string; border: string; bg: string }
> = {
  INFO:    { icon: Info,          glyph: '●', color: 'text-cyan-400',   dim: 'text-cyan-700',   border: 'border-l-cyan-500/50',   bg: 'bg-cyan-950/20'   },
  WARNING: { icon: AlertTriangle, glyph: '▲', color: 'text-amber-400',  dim: 'text-amber-700',  border: 'border-l-amber-400/60',  bg: 'bg-amber-950/20'  },
  ERROR:   { icon: XCircle,       glyph: '✕', color: 'text-red-400',    dim: 'text-red-700',    border: 'border-l-red-500/70',    bg: 'bg-red-950/30'    },
  DEBUG:   { icon: Circle,        glyph: '○', color: 'text-slate-500',  dim: 'text-slate-600',  border: 'border-l-slate-600/40',  bg: 'bg-slate-900/10'  },
};

const CATEGORY_COLORS: Record<string, string> = {
  migration:  'text-sky-500',
  validation: 'text-emerald-500',
  rollback:   'text-amber-500',
  system:     'text-slate-500',
};

// ── Single log row ────────────────────────────────────────────────────────────

function LogRow({ entry, isLatest }: { entry: LogEntry; isLatest: boolean }) {
  const [expanded, setExpanded] = useState(false);

  const ts = new Date(entry.timestamp * 1000);
  const lvl = LEVEL_CONFIG[entry.level] ?? LEVEL_CONFIG.INFO;
  const catColor = CATEGORY_COLORS[entry.category] ?? 'text-slate-500';

  const extraFields = Object.entries(entry).filter(
    ([k]) =>
      !['timestamp', 'level', 'category', 'message', 'app_id', 'trace_id', 'phase'].includes(k) &&
      entry[k] !== undefined &&
      entry[k] !== null,
  );
  const hasExtra = extraFields.length > 0;

  return (
    <div
      className={[
        'group relative border-b border-b-slate-800/50 font-mono text-[13px] transition-all duration-200',
        isLatest
          ? `${lvl.bg} border-l-2 ${lvl.border}`
          : 'border-l-2 border-l-transparent hover:border-l-slate-700 hover:bg-slate-900/30',
      ].join(' ')}
    >
      {isLatest && (
        <span
          className={`absolute left-0 top-0 bottom-0 w-0.5 ${lvl.color} animate-pulse`}
          style={{ filter: 'brightness(1.5)' }}
        />
      )}

      <div
        className={['flex items-baseline gap-0 px-4 py-[7px] min-w-0', hasExtra ? 'cursor-pointer' : ''].join(' ')}
        onClick={() => hasExtra && setExpanded((e) => !e)}
      >
        {/* Timestamp */}
        <span className="shrink-0 text-slate-600 w-[88px] text-[11px] select-none tabular-nums">
          {format(ts, 'HH:mm:ss.SSS')}
        </span>

        {/* Level glyph */}
        <span className={`shrink-0 w-5 text-center ${lvl.color} text-[10px] select-none`}>
          {lvl.glyph}
        </span>

        {/* Level label */}
        <span className={`shrink-0 w-[58px] text-[10px] font-bold tracking-widest uppercase ${lvl.dim} select-none`}>
          [{entry.level}]
        </span>

        {/* Category */}
        <span className={`shrink-0 w-[86px] text-[10px] uppercase tracking-wider ${catColor} opacity-60 select-none`}>
          {entry.category}
        </span>

        {/* Message */}
        <span
          className={[
            'flex-1 min-w-0 leading-relaxed transition-colors',
            isLatest ? 'text-white' : 'text-slate-300 group-hover:text-slate-100',
          ].join(' ')}
        >
          {entry.message}
        </span>

        {/* Meta tags */}
        <div className="shrink-0 flex items-center gap-2 ml-3">
          {entry.app_id && (
            <span className="text-[10px] text-slate-600 bg-slate-800/60 px-1.5 py-0.5 rounded select-none">
              {entry.app_id}
            </span>
          )}
          {entry.phase && (
            <span className="text-[10px] text-slate-600 hidden lg:inline select-none">
              {entry.phase}
            </span>
          )}
          {hasExtra && (
            <ChevronDown
              className={`w-3 h-3 text-slate-600 transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
            />
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && hasExtra && (
        <div className="mx-4 mb-2 bg-[#0a0f1a] border border-slate-800/60 rounded p-3">
          <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2">
            {extraFields.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-[9px] font-bold uppercase tracking-widest text-slate-600">{k}</dt>
                <dd className="text-[11px] text-slate-400 break-all mt-0.5">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

// ── Filter dropdown ───────────────────────────────────────────────────────────

type FilterMode = 'all' | 'errors' | 'success';

const FILTER_OPTIONS: { value: FilterMode; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'all',     label: 'All Levels', icon: Activity,     color: 'text-slate-400'   },
  { value: 'errors',  label: 'Errors',     icon: XCircle,      color: 'text-red-400'     },
  { value: 'success', label: 'Success',    icon: CheckCircle2, color: 'text-emerald-400' },
];

function FilterDropdown({ value, onChange }: { value: FilterMode; onChange: (v: FilterMode) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = FILTER_OPTIONS.find((o) => o.value === value)!;
  const Icon = current.icon;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 bg-[#0d1424] border border-slate-700/60 rounded text-[12px] font-mono hover:border-slate-600 transition-colors focus:outline-none focus:border-slate-500"
      >
        <Icon className={`w-3.5 h-3.5 ${current.color}`} />
        <span className="text-slate-300">{current.label}</span>
        <ChevronDown className={`w-3 h-3 text-slate-600 ml-1 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-30 bg-[#0a0f1a] border border-slate-700/80 rounded shadow-2xl shadow-black/60 min-w-[144px] py-1 overflow-hidden">
          {FILTER_OPTIONS.map((opt) => {
            const OptIcon = opt.icon;
            return (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={[
                  'w-full flex items-center gap-2.5 px-3 py-2 text-[12px] font-mono transition-colors',
                  opt.value === value
                    ? 'bg-slate-800/60 text-white'
                    : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200',
                ].join(' ')}
              >
                <OptIcon className={`w-3.5 h-3.5 ${opt.color}`} />
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LogsPage() {
  const [filter, setFilter] = useState<FilterMode>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  const { data: logs = [], isFetching } = useLogs({ limit: 500 });

  const filtered = useMemo(() => {
    const sorted = [...logs].sort((a, b) => a.timestamp - b.timestamp);
    if (filter === 'errors') return sorted.filter((e) => e.level === 'ERROR' || e.level === 'WARNING');
    if (filter === 'success') return sorted.filter((e) => e.level === 'INFO');
    return sorted;
  }, [logs, filter]);

  const counts = useMemo(() => ({
    total: logs.length,
    info:  logs.filter((e) => e.level === 'INFO').length,
    warn:  logs.filter((e) => e.level === 'WARNING').length,
    error: logs.filter((e) => e.level === 'ERROR').length,
  }), [logs]);

  // Auto-scroll
  const scrollToBottom = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (autoScroll && !userScrolledRef.current) {
      scrollToBottom();
    }
  }, [filtered, autoScroll, scrollToBottom]);

  const handleScroll = useCallback(() => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 48;
    userScrolledRef.current = !atBottom;
    if (atBottom && !autoScroll) setAutoScroll(true);
  }, [autoScroll]);

  const handleToggleAutoScroll = () => {
    const next = !autoScroll;
    setAutoScroll(next);
    if (next) {
      userScrolledRef.current = false;
      scrollToBottom();
    }
  };

  return (
    <div className="flex flex-col h-full max-h-full min-h-0 font-mono">
      {/* Terminal chrome header */}
      <div
        className="shrink-0 border border-slate-700/50 rounded-xl overflow-hidden mb-3"
        style={{ background: 'linear-gradient(160deg, #0d1424 0%, #08111e 100%)' }}
      >
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800/70 bg-[#070c17]">
          <span className="w-3 h-3 rounded-full bg-red-500/70" />
          <span className="w-3 h-3 rounded-full bg-amber-400/70" />
          <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
          <div className="flex-1 flex items-center justify-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-[11px] text-slate-600 tracking-widest uppercase select-none">
              bcl — system log stream
            </span>
          </div>
          {isFetching && <RefreshCw className="w-3.5 h-3.5 text-slate-700 animate-spin" />}
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
          {/* Counters */}
          <div className="flex items-center gap-4 text-[11px]">
            <span className="text-slate-600">
              lines <span className="text-slate-400 tabular-nums">{counts.total}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 opacity-80" />
              <span className="text-cyan-700 tabular-nums">{counts.info}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 opacity-80" />
              <span className="text-amber-700 tabular-nums">{counts.warn}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 opacity-80" />
              <span className="text-red-700 tabular-nums">{counts.error}</span>
            </span>
          </div>

          <div className="flex-1" />

          {/* Filter */}
          <FilterDropdown value={filter} onChange={setFilter} />

          {/* Auto-scroll toggle */}
          <button
            onClick={handleToggleAutoScroll}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] border transition-all duration-200',
              autoScroll
                ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-400 hover:bg-emerald-950/60'
                : 'bg-[#0d1424] border-slate-700/60 text-slate-600 hover:border-slate-600 hover:text-slate-400',
            ].join(' ')}
          >
            <ChevronsDown className="w-3.5 h-3.5" />
            auto-scroll
            <span
              className={[
                'w-1.5 h-1.5 rounded-full ml-0.5',
                autoScroll ? 'bg-emerald-400 animate-pulse' : 'bg-slate-700',
              ].join(' ')}
            />
          </button>

          {/* Jump to bottom — only when user has scrolled up */}
          {!autoScroll && (
            <button
              onClick={() => { userScrolledRef.current = false; scrollToBottom(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] border border-slate-700/60 text-slate-500 hover:border-slate-500 hover:text-slate-300 bg-[#0d1424] transition-colors"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              jump to end
            </button>
          )}
        </div>
      </div>

      {/* Log panel */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-slate-700/50 bg-[#070c17]"
        style={{ scrollBehavior: 'smooth' }}
      >
        {/* Column labels */}
        <div className="sticky top-0 z-10 flex items-center gap-0 px-4 py-1.5 border-b border-slate-800/80 text-[9px] uppercase tracking-widest text-slate-700 select-none bg-[#070c17]">
          <span className="w-[88px]">time</span>
          <span className="w-5" />
          <span className="w-[58px]">level</span>
          <span className="w-[86px]">category</span>
          <span className="flex-1">message</span>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-700">
            <Terminal className="w-8 h-8 mb-3 opacity-20" />
            <p className="text-[13px] tracking-wide">no log entries</p>
            <p className="text-[11px] mt-1 opacity-50">
              {filter !== 'all' ? `no ${filter} logs found` : 'waiting for events…'}
            </p>
          </div>
        ) : (
          <>
            {filtered.map((entry, i) => (
              <LogRow
                key={`${entry.timestamp}-${i}`}
                entry={entry}
                isLatest={i === filtered.length - 1}
              />
            ))}
            <div className="h-4" />
          </>
        )}
      </div>

      {/* Status bar */}
      <div className="shrink-0 mt-1.5 flex items-center gap-3 px-2 text-[11px] font-mono text-slate-700 select-none">
        <span className={isFetching ? 'text-cyan-800' : ''}>
          {isFetching ? '● streaming' : '○ idle'}
        </span>
        <span className="flex-1" />
        <span>
          {filtered.length} / {counts.total} entries
        </span>
      </div>
    </div>
  );
}
