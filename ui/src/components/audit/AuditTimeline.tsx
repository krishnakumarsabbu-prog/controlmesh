import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import type { AuditEvent } from '../../types';

const OP_COLORS: Record<string, string> = {
  CREATE_QUEUE:   'bg-blue-100 text-blue-700',
  CREATE_CHANNEL: 'bg-sky-100 text-sky-700',
  VALIDATION:     'bg-emerald-100 text-emerald-700',
  ROLLBACK:       'bg-orange-100 text-orange-700',
  DELETE_QUEUE:   'bg-red-100 text-red-700',
  MIGRATE:        'bg-amber-100 text-amber-700',
};

export default function AuditTimeline({ events }: { events: AuditEvent[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-50">
        {events.length === 0 && (
          <p className="text-center text-slate-400 py-12 text-sm">
            No audit events yet. Provision or migrate to see activity.
          </p>
        )}
        {events.map((event, i) => (
          <motion.div
            key={`${event.timestamp}-${i}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i < 20 ? i * 0.02 : 0, duration: 0.15 }}
            className="flex items-center gap-4 px-4 py-2.5 hover:bg-slate-50 transition-colors"
          >
            {/* Timestamp */}
            <span className="text-slate-400 tabular-nums text-xs w-24 shrink-0">
              {formatDistanceToNow(new Date(event.timestamp * 1000), { addSuffix: true })}
            </span>

            {/* Operation badge */}
            <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 font-mono ${
              OP_COLORS[event.operation] ?? 'bg-slate-100 text-slate-600'
            }`}>
              {event.operation}
            </span>

            {/* QM */}
            <span className="text-slate-500 font-mono text-xs w-28 shrink-0 truncate">
              {event.qm_target}
            </span>

            {/* Agent */}
            <span className="text-slate-400 text-xs flex-1 truncate">
              {event.agent}
            </span>

            {/* Result */}
            <span className={`text-xs font-semibold shrink-0 ${
              event.result === 'SUCCESS' || event.result === 'PASS'
                ? 'text-emerald-600'
                : event.result === 'FAIL' || event.result === 'ERROR'
                ? 'text-red-500'
                : 'text-amber-600'
            }`}>
              {event.result}
            </span>

            {/* Trace ID */}
            {event.trace_id && (
              <span className="text-slate-300 font-mono text-[10px] shrink-0">
                {event.trace_id.slice(0, 8)}
              </span>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
