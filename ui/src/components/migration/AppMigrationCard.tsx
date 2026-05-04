import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, RotateCcw, ChevronDown, ChevronUp, Clock, ListChecks, Loader as Loader2, MessageSquare, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { MigrationRecord, MigrationPlanStep, RollbackStep, TopologySnapshot } from '../../types';
import { planMigration } from '../../api/migration';
import { mockApi } from '../../api/mock/service';
import StateBadge from './StateBadge';
import MigrationStepper from './MigrationStepper';
import PlanTimeline from './PlanTimeline';
import RollbackTimeline from './RollbackTimeline';
import ExplainPanel from './ExplainPanel';

interface AppConfig { id: string; source: string; target: string; }

interface Props {
  app: AppConfig;
  record: MigrationRecord | undefined;
  onMigrate: () => void;
  onRollback: () => void;
  isLoading: boolean;
  isAutonomousTarget?: boolean;
}

const ACTIVE_STATES = ['SNAPSHOTTED', 'PROVISIONING_TARGET', 'REWIRING', 'VALIDATING', 'ROLLING_BACK'];
const ROLLBACK_STATES = ['ROLLING_BACK', 'ROLLED_BACK'];

type ExpandedView = 'stepper' | 'plan' | 'rollback' | 'explain' | null;

export default function AppMigrationCard({ app, record, onMigrate, onRollback, isLoading, isAutonomousTarget }: Props) {
  const [expandedView, setExpandedView] = useState<ExpandedView>(null);
  const [planSteps, setPlanSteps] = useState<MigrationPlanStep[] | null>(null);
  const [planReasoning, setPlanReasoning] = useState<string | undefined>(undefined);
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
    state === 'ROLLING_BACK'  ? 'border-red-800 shadow-md shadow-red-900/20' :
    state === 'ROLLED_BACK'   ? 'border-orange-800' :
    isAutonomousTarget        ? 'border-emerald-600 shadow-md shadow-emerald-900/30' :
    isActive                  ? 'border-amber-800 shadow-md shadow-amber-900/20' :
    state === 'MIGRATED'      ? 'border-emerald-800' :
    'border-surface-border';

  const avatarClass =
    state === 'MIGRATED'     ? 'bg-emerald-900/40 text-emerald-300' :
    state === 'IDLE'         ? 'bg-surface-muted text-text-secondary' :
    state === 'ROLLING_BACK' ? 'bg-red-900/40 text-red-300'         :
    state === 'ROLLED_BACK'  ? 'bg-orange-900/40 text-orange-300'   :
    isActive                 ? 'bg-amber-900/40 text-amber-300'     :
    'bg-surface-muted text-text-secondary';

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
        setPlanReasoning(result.plan_reasoning);
      } finally {
        setPlanLoading(false);
      }
    }
  };

  const toggleRollback = () => {
    setExpandedView((v) => v === 'rollback' ? null : 'rollback');
  };

  const toggleExplain = () => {
    setExpandedView((v) => v === 'explain' ? null : 'explain');
  };

  const isRollbackComplete = state === 'ROLLED_BACK';
  const showRollbackButton = isRollingBack && expandedView !== 'rollback';

  return (
    <motion.div
      layout
      data-testid={`migration-row-${app.id}`}
      className={`rounded-xl border bg-surface-card overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover ${borderClass}`}
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

      {/* Autonomous target banner */}
      <AnimatePresence>
        {isAutonomousTarget && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-1.5 bg-emerald-900/50 border-b border-emerald-800 text-emerald-300 text-xs font-medium">
              <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 0.9, repeat: Infinity }}>
                <Zap className="w-3 h-3" />
              </motion.div>
              Autonomous migration agent active
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
          <div className="font-semibold text-text-primary text-sm">{app.id}</div>
          <div className="text-[11px] text-text-muted font-mono truncate">
            {app.source} → {app.target}
          </div>
        </div>
        <StateBadge state={state} />
        <div className="flex items-center gap-1 ml-1 shrink-0">
          {canMigrate && (
            <button
              onClick={onMigrate}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-blue hover:bg-accent-blue-hover text-white rounded-lg text-xs font-medium transition-all duration-150 active:scale-95 disabled:opacity-50"
            >
              <Play className="w-3 h-3" />
              Migrate
            </button>
          )}
          {canRollback && (
            <button
              onClick={onRollback}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-300 rounded-lg text-xs font-medium transition-all duration-150 disabled:opacity-50 border border-red-800"
            >
              <RotateCcw className="w-3 h-3" />
              Rollback
            </button>
          )}
          {isRollingBack && (
            <button
              onClick={toggleRollback}
              title="View rollback progress"
              className={`p-1.5 rounded-lg transition-colors ${expandedView === 'rollback' ? 'bg-red-900/40 text-red-300' : 'hover:bg-surface-overlay text-text-muted'}`}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          {!isRollingBack && (
            <button
              onClick={togglePlan}
              title="View migration plan"
              className={`p-1.5 rounded-lg transition-colors ${expandedView === 'plan' ? 'bg-blue-900/40 text-blue-300' : 'hover:bg-surface-overlay text-text-muted'}`}
            >
              <ListChecks className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={toggleExplain}
            title="Explain migration"
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${expandedView === 'explain' ? 'bg-blue-900/40 text-blue-300 border border-blue-800' : 'hover:bg-surface-overlay text-text-secondary border border-surface-border'}`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Explain
          </button>
          <button
            onClick={toggleStepper}
            className="p-1.5 rounded-lg hover:bg-surface-overlay transition-colors"
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
        <div className="flex items-center gap-1.5 px-4 pb-2 text-[11px] text-text-muted">
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
            className="overflow-hidden border-t border-surface-border"
          >
            {expandedView === 'stepper' && (
              <MigrationStepper record={record} />
            )}
            {expandedView === 'plan' && (
              planLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-text-muted">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating plan…
                </div>
              ) : planSteps ? (
                <PlanTimeline steps={planSteps} planReasoning={planReasoning} />
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
            {expandedView === 'explain' && (
              <ExplainPanel app={app} record={record} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
