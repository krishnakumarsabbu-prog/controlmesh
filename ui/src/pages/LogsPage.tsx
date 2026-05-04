import { useState, useMemo } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { Activity, CircleArrowUp as ArrowUpCircle, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, Circle as XCircle, Info, RefreshCw, ChevronDown, ChevronUp, ListFilter as Filter } from 'lucide-react';
import { useLogs } from '../hooks/useLogs';
import type { LogEntry, LogLevel, LogCategory } from '../types';

// ── Category config ───────────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<
  string,
  { label: string; dot: string; bg: string; border: string }
> = {
  migration:  { label: 'Migration',  dot: 'bg-sky-500',    bg: 'bg-sky-50',    border: 'border-sky-200'  },
  validation: { label: 'Validation', dot: 'bg-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  rollback:   { label: 'Rollback',   dot: 'bg-amber-500',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  system:     { label: 'System',     dot: 'bg-slate-400',  bg: 'bg-slate-50',  border: 'border-slate-200' },
};

const LEVEL_CONFIG: Record<
  LogLevel,
  { icon: React.ElementType; color: string; badge: string }
> = {
  INFO:    { icon: Info,          color: 'text-sky-600',    badge: 'bg-sky-100 text-sky-700'    },
  WARNING: { icon: AlertTriangle, color: 'text-amber-500',  badge: 'bg-amber-100 text-amber-700' },
  ERROR:   { icon: XCircle,       color: 'text-red-500',    badge: 'bg-red-100 text-red-700'    },
  DEBUG:   { icon: Activity,      color: 'text-slate-400',  badge: 'bg-slate-100 text-slate-600' },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function LogRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);

  const ts = new Date(entry.timestamp * 1000);
  const catStyle = CATEGORY_STYLES[entry.category] ?? CATEGORY_STYLES.system;
  const lvl = LEVEL_CONFIG[entry.level] ?? LEVEL_CONFIG.INFO;
  const LvlIcon = lvl.icon;

  const extraFields = Object.entries(entry).filter(
    ([k]) =>
      !['timestamp', 'level', 'category', 'message', 'app_id', 'trace_id'].includes(k) &&
      entry[k] !== undefined &&
      entry[k] !== null,
  );

  return (
    <div
      className={`group border-l-2 ${
        entry.level === 'ERROR'
          ? 'border-l-red-400'
          : entry.level === 'WARNING'
          ? 'border-l-amber-400'
          : 'border-l-slate-200'
      } hover:border-l-sky-400 transition-colors duration-150`}
    >
      <div
        className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors duration-100"
        onClick={() => setExpanded((e) => !e)}
      >
        {/* Level icon */}
        <div className="mt-0.5 shrink-0">
          <LvlIcon className={`w-4 h-4 ${lvl.color}`} />
        </div>

        {/* Timestamp */}
        <div className="shrink-0 w-36 text-xs text-slate-400 font-mono pt-0.5">
          <div>{format(ts, 'HH:mm:ss.SSS')}</div>
          <div className="text-slate-300 text-[10px]">
            {formatDistanceToNow(ts, { addSuffix: true })}
          </div>
        </div>

        {/* Category + Level badges */}
        <div className="shrink-0 flex flex-col gap-1 mt-0.5">
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${catStyle.bg} ${catStyle.border} border`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${catStyle.dot}`} />
            {catStyle.label}
          </span>
          <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${lvl.badge}`}>
            {entry.level}
          </span>
        </div>

        {/* Message + meta */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-800 leading-snug font-medium break-words">
            {entry.message}
          </p>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {entry.app_id && (
              <span className="text-[11px] text-slate-500 font-mono">
                app:{entry.app_id}
              </span>
            )}
            {entry.phase && (
              <span className="text-[11px] text-slate-400 font-mono uppercase tracking-wide">
                {entry.phase}
              </span>
            )}
            {entry.trace_id && (
              <span className="text-[11px] text-slate-300 font-mono hidden md:inline">
                trace:{String(entry.trace_id).slice(0, 8)}
              </span>
            )}
          </div>
        </div>

        {/* Expand toggle */}
        {extraFields.length > 0 && (
          <div className="shrink-0 text-slate-300 group-hover:text-slate-400 mt-1">
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        )}
      </div>

      {/* Expanded detail panel */}
      {expanded && extraFields.length > 0 && (
        <div className="mx-4 mb-3 mt-0 border border-slate-100 rounded-lg bg-slate-50 p-3">
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
            {extraFields.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {k}
                </dt>
                <dd className="text-xs text-slate-700 font-mono break-all mt-0.5">
                  {String(v)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

function TimeGroup({ label, entries }: { label: string; entries: LogEntry[] }) {
  return (
    <div className="mb-6">
      <div className="sticky top-0 z-10 bg-slate-50 px-4 py-2 flex items-center gap-2 border-b border-slate-100">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          {label}
        </span>
        <span className="text-xs text-slate-300">({entries.length})</span>
      </div>
      <div className="divide-y divide-slate-50 bg-white">
        {entries.map((e, i) => (
          <LogRow key={`${e.timestamp}-${i}`} entry={e} />
        ))}
      </div>
    </div>
  );
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function groupByTime(entries: LogEntry[]): { label: string; entries: LogEntry[] }[] {
  const now = Date.now();
  const groups: Record<string, LogEntry[]> = {};

  for (const e of entries) {
    const diffMs = now - e.timestamp * 1000;
    let label: string;
    if (diffMs < 60_000) label = 'Just now';
    else if (diffMs < 3_600_000) label = 'Last hour';
    else if (diffMs < 86_400_000) label = 'Today';
    else label = format(new Date(e.timestamp * 1000), 'MMMM d, yyyy');

    if (!groups[label]) groups[label] = [];
    groups[label].push(e);
  }

  const order = ['Just now', 'Last hour', 'Today'];
  return Object.entries(groups)
    .sort(([a], [b]) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return b.localeCompare(a);
    })
    .map(([label, entries]) => ({ label, entries }));
}

// ── Main page ─────────────────────────────────────────────────────────────────

const CATEGORIES: { value: LogCategory | ''; label: string }[] = [
  { value: '', label: 'All categories' },
  { value: 'migration', label: 'Migration' },
  { value: 'validation', label: 'Validation' },
  { value: 'rollback', label: 'Rollback' },
  { value: 'system', label: 'System' },
];

const LEVELS: { value: LogLevel | ''; label: string }[] = [
  { value: '', label: 'All levels' },
  { value: 'INFO', label: 'Info' },
  { value: 'WARNING', label: 'Warning' },
  { value: 'ERROR', label: 'Error' },
];

export default function LogsPage() {
  const [category, setCategory] = useState<LogCategory | ''>('');
  const [level, setLevel] = useState<LogLevel | ''>('');
  const [appId, setAppId] = useState('');
  const [search, setSearch] = useState('');

  const { data: logs = [], isFetching, dataUpdatedAt } = useLogs({
    category: category || undefined,
    level: level || undefined,
    app_id: appId || undefined,
    limit: 500,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return logs;
    const q = search.toLowerCase();
    return logs.filter(
      (e) =>
        e.message.toLowerCase().includes(q) ||
        (e.app_id ?? '').toLowerCase().includes(q) ||
        (e.trace_id ?? '').toLowerCase().includes(q),
    );
  }, [logs, search]);

  const grouped = useMemo(() => groupByTime(filtered), [filtered]);

  const counts = useMemo(
    () => ({
      error: logs.filter((e) => e.level === 'ERROR').length,
      warning: logs.filter((e) => e.level === 'WARNING').length,
      info: logs.filter((e) => e.level === 'INFO').length,
    }),
    [logs],
  );

  return (
    <div className="flex flex-col h-full max-h-full min-h-0">
      {/* Header */}
      <div className="shrink-0 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">System Logs</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Migration steps, validation results, and rollback actions
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isFetching && (
              <RefreshCw className="w-4 h-4 text-sky-500 animate-spin" />
            )}
            <span className="text-xs text-slate-400">
              {dataUpdatedAt
                ? `Updated ${formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true })}`
                : ''}
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Total',    value: logs.length,    icon: Activity,      color: 'text-slate-600',  bg: 'bg-slate-50',   border: 'border-slate-200' },
            { label: 'Info',     value: counts.info,    icon: CheckCircle2,  color: 'text-sky-600',    bg: 'bg-sky-50',     border: 'border-sky-200'   },
            { label: 'Warnings', value: counts.warning, icon: ArrowUpCircle, color: 'text-amber-500',  bg: 'bg-amber-50',   border: 'border-amber-200' },
            { label: 'Errors',   value: counts.error,   icon: XCircle,       color: 'text-red-500',    bg: 'bg-red-50',     border: 'border-red-200'   },
          ].map(({ label, value, icon: Icon, color, bg, border }) => (
            <div
              key={label}
              className={`rounded-xl ${bg} border ${border} px-4 py-3 flex items-center gap-3`}
            >
              <Icon className={`w-5 h-5 ${color}`} />
              <div>
                <div className={`text-xl font-bold ${color}`}>{value}</div>
                <div className="text-xs text-slate-500">{label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <div className="shrink-0 bg-white border border-slate-200 rounded-xl px-4 py-3 mb-4 flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Search messages, app IDs, trace IDs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 text-sm bg-transparent border-none outline-none placeholder-slate-400 text-slate-700"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as LogCategory | '')}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-sky-300"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as LogLevel | '')}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-sky-300"
          >
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="App ID"
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            className="w-28 text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-sky-300 placeholder-slate-400"
          />
          {(category || level || appId || search) && (
            <button
              onClick={() => { setCategory(''); setLevel(''); setAppId(''); setSearch(''); }}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors px-2 py-1 rounded-lg hover:bg-slate-100"
            >
              Clear
            </button>
          )}
        </div>
        <span className="ml-auto text-xs text-slate-400 shrink-0">
          {filtered.length} of {logs.length} entries
        </span>
      </div>

      {/* Timeline */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-slate-200 bg-white">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <Activity className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">No log entries match your filters</p>
          </div>
        ) : (
          grouped.map(({ label, entries }) => (
            <TimeGroup key={label} label={label} entries={entries} />
          ))
        )}
      </div>
    </div>
  );
}
