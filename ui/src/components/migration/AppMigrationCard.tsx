import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, RotateCcw, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { MigrationRecord } from '../../types';
import StateBadge from './StateBadge';
import MigrationStepper from './MigrationStepper';

interface AppConfig { id: string; source: string; target: string; }

interface Props {
  app: AppConfig;
  record: MigrationRecord | undefined;
  onMigrate: () => void;
  onRollback: () => void;
  isLoading: boolean;
}

const ACTIVE_STATES = ['SNAPSHOTTED', 'PROVISIONING_TARGET', 'REWIRING', 'VALIDATING', 'ROLLING_BACK'];

export default function AppMigrationCard({ app, record, onMigrate, onRollback, isLoading }: Props) {
  const [expanded, setExpanded] = useState(false);
  const state = record?.state ?? 'IDLE';
  const canMigrate = state === 'IDLE' || state === 'ROLLED_BACK';
  const canRollback = ['SNAPSHOTTED', 'PROVISIONING_TARGET', 'REWIRING', 'VALIDATING'].includes(state);
  const isActive = ACTIVE_STATES.includes(state);

  const borderClass =
    isActive            ? 'border-amber-200 shadow-amber-50 shadow-md' :
    state === 'MIGRATED' ? 'border-emerald-200' :
    state === 'ROLLED_BACK' ? 'border-orange-200' :
    'border-slate-200';

  const avatarClass =
    state === 'MIGRATED'    ? 'bg-emerald-100 text-emerald-700' :
    state === 'IDLE'        ? 'bg-slate-100 text-slate-500'     :
    isActive                ? 'bg-amber-100 text-amber-700'     :
    state === 'ROLLED_BACK' ? 'bg-orange-100 text-orange-700'  :
    'bg-slate-100 text-slate-500';

  return (
    <motion.div
      layout
      data-testid={`migration-row-${app.id}`}
      className={`rounded-xl border bg-white overflow-hidden transition-all duration-300 ${borderClass}`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm ${avatarClass}`}>
          {app.id.replace('APP', '')}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-800 text-sm">{app.id}</div>
          <div className="text-[11px] text-slate-400 font-mono truncate">
            {app.source} → {app.target}
          </div>
        </div>
        <StateBadge state={state} />
        <div className="flex items-center gap-1 ml-1 shrink-0">
          {canMigrate && (
            <button
              onClick={onMigrate}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              <Play className="w-3 h-3" />
              Migrate
            </button>
          )}
          {canRollback && (
            <button
              onClick={onRollback}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 border border-red-200"
            >
              <RotateCcw className="w-3 h-3" />
              Rollback
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            {expanded
              ? <ChevronUp className="w-4 h-4 text-slate-400" />
              : <ChevronDown className="w-4 h-4 text-slate-400" />
            }
          </button>
        </div>
      </div>

      {/* Timestamps */}
      {record?.started_at && (
        <div className="flex items-center gap-1.5 px-4 pb-2 text-[11px] text-slate-400">
          <Clock className="w-3 h-3" />
          Started {formatDistanceToNow(new Date(record.started_at), { addSuffix: true })}
          {record.error && (
            <span className="ml-2 text-red-400 truncate">• {record.error}</span>
          )}
        </div>
      )}

      {/* Expanded stepper */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-slate-100"
          >
            <MigrationStepper record={record} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
