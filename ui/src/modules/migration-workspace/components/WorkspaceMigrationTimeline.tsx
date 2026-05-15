import { motion } from 'framer-motion';
import { CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, Circle as XCircle, Info, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useWorkspaceStore } from '../store/workspaceStore';
import type { WorkspaceTimelineEvent } from '../types';

const TYPE_CONFIG = {
  info:    { icon: Info,         color: '#6366f1', bg: 'rgba(99,102,241,0.1)',  border: 'rgba(99,102,241,0.25)' },
  success: { icon: CheckCircle2, color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.25)'  },
  warning: { icon: AlertTriangle,color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)' },
  error:   { icon: XCircle,      color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)'  },
};

function TimelineItem({ event, isLast }: { event: WorkspaceTimelineEvent; isLast: boolean }) {
  const cfg = TYPE_CONFIG[event.type];
  const Icon = cfg.icon;

  return (
    <div className="flex gap-3">
      {/* Spine */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center border shrink-0"
          style={{ background: cfg.bg, borderColor: cfg.border }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
        </div>
        {!isLast && <div className="w-px flex-1 mt-1" style={{ background: 'var(--surface-border)' }} />}
      </div>

      {/* Content */}
      <div className="pb-4 min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-semibold text-text-primary">{event.title}</span>
          <div className="flex items-center gap-1 text-[10px] text-text-muted ml-auto shrink-0">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(event.timestamp, { addSuffix: true })}
          </div>
        </div>
        {event.detail && (
          <p className="text-[11px] text-text-muted leading-relaxed">{event.detail}</p>
        )}
        <div
          className="inline-flex mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
          style={{ background: 'var(--surface-overlay)', color: 'var(--text-muted)' }}
        >
          {event.step.replace(/-/g, ' ')}
        </div>
      </div>
    </div>
  );
}

export default function WorkspaceMigrationTimeline() {
  const { timelineEvents } = useWorkspaceStore();
  const sorted = [...timelineEvents].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="flex flex-col h-full">
      <div className="section-title mb-3">Migration Timeline</div>
      <div className="flex-1 overflow-y-auto">
        {sorted.map((event, i) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <TimelineItem event={event} isLast={i === sorted.length - 1} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
