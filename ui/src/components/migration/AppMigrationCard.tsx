import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, RotateCcw, ChevronDown, ChevronUp, Clock, ListChecks, Loader as Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { MigrationRecord, MigrationPlanStep, RollbackStep, TopologySnapshot } from '../../types';
import { planMigration } from '../../api/migration';
import { mockApi } from '../../api/mock/service';
import StateBadge from './StateBadge';
import MigrationStepper from './MigrationStepper';
import PlanTimeline from './PlanTimeline';
import RollbackTimeline from './RollbackTimeline';

interface AppConfig { id: string; source: string; target: string; }

interface Props {
  app: AppConfig;
  record: MigrationRecord | undefined;
  onMigrate: () => void;
  onRollback: () => void;
  isLoading: boolean;
}

const ACTIVE_STATES = ['SNAPSHOTTED', 'PROVISIONING_TARGET', 'REWIRING', 'VALIDATING', 'ROLLING_BACK'];
const ROLLBACK_STATES = ['ROLLING_BACK', 'ROLLED_BACK'];

type ExpandedView = 'stepper' | 'plan' | 'rollback' | null;

export default function AppMigrationCard({ app, record, onMigrate, onRollback, isLoading }: Props) {
  const [expandedView, setExpandedView] = useState<ExpandedView>(null);
  const [planSteps, setPlanSteps] = useState<MigrationPlanStep[] | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [rollbackStepList, setRollbackStepList] = useState<RollbackStep[] | null>(null);
  const [snapshot, setSnapshot] = useState<TopologySnapshot | null>(null);
  const prevStateRef = useRef<string | undefined>(undefined);
  const state = record?.state ?? 'IDLE';
  const canMigrate = state === 'IDLE' || state === 'ROLLED_BACK';
  const canRollback = ['SNAPSHOTTED', 'PROVISIONING_TARGET', 'REWIRING', 'VALIDATING'].includes(state);
  const isActive = ACTIVE_STATES.includes(state);
  const isRollingBack = ROLLBACK_STATES.includes(state);

  // Auto-open plan view when migration starts; auto-open rollback view when rollback starts
  useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = state;

    if (prev !== state) {
      if (state === 'ROLLING_BACK') {
        setExpandedView('rollback');
        // Capture snapshot when rollback starts
        const snap = mockApi.getSnapshot(app.id);
        setSnapshot(snap);
      } else if (ACTIVE_STATES.includes(state) && !ACTIVE_STATES.includes(prev ?? '')) {
        setExpandedView('plan');
      }
    }
  }, [state, app.id]);

  // Subscribe to live plan step updates from mock service
  useEffect(() => {
    if (!isActive && state !== 'MIGRATED') return;

    const unsubscribe = mockApi.subscribePlanSteps(app.id, (steps) => {
      setPlanSteps([...steps]);
    });
    return unsubscribe;
  }, [app.id, isActive, state]);

  // Subscribe to rollback step updates
  useEffect(() => {
    if (!isRollingBack) return;

    // Load snapshot for display
    const snap = mockApi.getSnapshot(app.id);
    setSnapshot(snap);

    // Load any existing rollback steps immediately
    const existing = mockApi.getRollbackSteps(app.id);
    if (existing) setRollbackStepList([...existing]);

    const unsubscribe = mockApi.subscribeRollbackSteps(app.id, (steps) => {
      setRollbackStepList([...steps]);
    });
    return unsubscribe;
  }, [app.id, isRollingBack]);

  const borderClass =
    state === 'ROLLING_BACK'  ? 'border-red-200 shadow-red-50 shadow-md' :
    state === 'ROLLED_BACK'   ? 'border-orange-200' :
    isActive                  ? 'border-amber-200 shadow-amber-50 shadow-md' :
    state === 'MIGRATED'      ? 'border-emerald-200' :
    'border-slate-200';

  const avatarClass =
    state === 'MIGRATED'     ? 'bg-emerald-100 text-emerald-700' :
    state === 'IDLE'         ? 'bg-slate-100 text-slate-500'     :
    state === 'ROLLING_BACK' ? 'bg-red-100 text-red-700'         :
    state === 'ROLLED_BACK'  ? 'bg-orange-100 text-orange-700'   :
    isActive                 ? 'bg-amber-100 text-amber-700'     :
    'bg-slate-100 text-slate-500';

  const toggleStepper = () => {
    setExpandedView((v) => v === 'stepper' ? null : 'stepper');
  };

  const togglePlan = async () => {
    if (expandedView === 'plan') {
      setExpandedView(null);
      return;
    }
    setExpandedView('plan');
    if (!planSteps) {
      const liveSteps = mockApi.getPlanSteps(app.id);
      if (liveSteps) {
        setPlanSteps(liveSteps);
        return;
      }
      setPlanLoading(true);
      try {
        const result = await planMigration(app.id, app.source, app.target);
        setPlanSteps(result.plan);
      } finally {
        setPlanLoading(false);
      }
    }
  };

  const toggleRollback = () => {
    setExpandedView((v) => v === 'rollback' ? null : 'rollback');
  };

  const isRollbackComplete = state === 'ROLLED_BACK';
  const showRollbackButton = isRollingBack && expandedView !== 'rollback';

  return (
    <motion.div
      layout
      data-testid={`migration-row-${app.id}`}
      className={`rounded-xl border bg-white overflow-hidden transition-all duration-300 ${borderClass}`}
    >
      {/* Rollback in-progress banner */}
      <AnimatePresence>
        {state === 'ROLLING_BACK' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs font-medium">
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              >
                <RotateCcw className="w-3 h-3" />
              </motion.div>
              Automatic rollback in progress — restoring topology from snapshot
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
          {isRollingBack && (
            <button
              onClick={toggleRollback}
              title="View rollback progress"
              className={`p-1.5 rounded-lg transition-colors ${expandedView === 'rollback' ? 'bg-red-50 text-red-600' : 'hover:bg-slate-100 text-slate-400'}`}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          {!isRollingBack && (
            <button
              onClick={togglePlan}
              title="View migration plan"
              className={`p-1.5 rounded-lg transition-colors ${expandedView === 'plan' ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-100 text-slate-400'}`}
            >
              <ListChecks className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={toggleStepper}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            {expandedView === 'stepper'
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
          {record.error && state !== 'ROLLING_BACK' && (
            <span className="ml-2 text-red-400 truncate">• {record.error}</span>
          )}
        </div>
      )}

      {/* Expanded panel */}
      <AnimatePresence>
        {expandedView !== null && (
          <motion.div
            key={expandedView}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-slate-100"
          >
            {expandedView === 'stepper' && (
              <MigrationStepper record={record} />
            )}
            {expandedView === 'plan' && (
              planLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating plan…
                </div>
              ) : planSteps ? (
                <PlanTimeline steps={planSteps} />
              ) : null
            )}
            {expandedView === 'rollback' && rollbackStepList && (
              <RollbackTimeline
                steps={rollbackStepList}
                snapshot={snapshot}
                errorMessage={record?.error}
                isComplete={isRollbackComplete}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
