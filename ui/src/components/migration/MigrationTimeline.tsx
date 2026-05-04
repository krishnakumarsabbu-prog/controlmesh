import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { STATE_COLORS } from '../../lib/colors';
import type { MigrationRecord, MigrationState } from '../../types';

interface AppConfig { id: string; source: string; target: string; }

interface Props {
  apps: AppConfig[];
  migrations: Record<string, MigrationRecord>;
  currentAppId?: string | null;
}

const STATE_ORDER: MigrationState[] = [
  'IDLE', 'SNAPSHOTTED', 'PROVISIONING_TARGET', 'REWIRING', 'VALIDATING', 'MIGRATED',
];

const STATE_LABELS: Partial<Record<MigrationState, string>> = {
  IDLE:                 'Idle',
  SNAPSHOTTED:          'Snapshotted',
  PROVISIONING_TARGET:  'Provisioning',
  REWIRING:             'Rewiring',
  VALIDATING:           'Validating',
  MIGRATED:             'Migrated',
  ROLLING_BACK:         'Rolling Back',
  ROLLED_BACK:          'Rolled Back',
};

export default function MigrationTimeline({ apps, migrations, currentAppId }: Props) {
  return (
    <div className="card px-5 py-4">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Migration Progress Overview
        </div>
        <div className="flex items-center gap-4 text-[11px] text-text-muted">
          {STATE_ORDER.map((s) => (
            <div key={s} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATE_COLORS[s].dot }} />
              {STATE_LABELS[s]}
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {apps.map(({ id }) => {
          const record = migrations[id];
          const state = record?.state ?? 'IDLE';
          const isCurrent = currentAppId === id;
          const progress = state === 'IDLE' ? 0
            : state === 'ROLLED_BACK' || state === 'ROLLING_BACK' ? 15
            : ((STATE_ORDER.indexOf(state) / (STATE_ORDER.length - 1)) * 100);
          const colors = STATE_COLORS[state];

          return (
            <motion.div
              key={id}
              layout
              className={`flex items-center gap-3 px-2 py-1.5 rounded-lg transition-colors duration-200 ${
                isCurrent ? 'bg-emerald-900/20 border border-emerald-800' : ''
              }`}
            >
              <div className="flex items-center gap-1.5 w-16 shrink-0">
                {isCurrent && (
                  <motion.div
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 0.9, repeat: Infinity }}
                  >
                    <Zap className="w-3 h-3 text-emerald-400" />
                  </motion.div>
                )}
                <span className={`text-xs font-mono font-semibold ${isCurrent ? 'text-emerald-300' : 'text-text-secondary'}`}>
                  {id}
                </span>
              </div>

              {/* Phase markers */}
              <div className="flex-1 flex items-center gap-1">
                {STATE_ORDER.map((s, i) => {
                  const stateIdx = STATE_ORDER.indexOf(state);
                  const isActive = s === state;
                  const isPast = i < stateIdx;
                  const isFuture = i > stateIdx;
                  return (
                    <div key={s} className="flex items-center flex-1">
                      <motion.div
                        className="relative flex items-center justify-center"
                        animate={isActive ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                        transition={isActive ? { duration: 1.2, repeat: Infinity } : {}}
                      >
                        <div
                          className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
                            isActive ? 'ring-2 ring-offset-1 ring-offset-surface-bg' : ''
                          }`}
                          style={{
                            backgroundColor: isActive || isPast ? colors.dot : '#1f2937',
                            opacity: isFuture ? 0.25 : 1,
                          }}
                        />
                      </motion.div>
                      {i < STATE_ORDER.length - 1 && (
                        <div className="flex-1 h-px mx-0.5 transition-all duration-500"
                          style={{
                            backgroundColor: i < stateIdx ? colors.dot : '#1f2937',
                            opacity: i >= stateIdx ? 0.3 : 1,
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Progress bar + label */}
              <div className="w-32 shrink-0">
                <div className="w-full h-1.5 bg-surface-border rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    style={{ backgroundColor: colors.dot }}
                  />
                </div>
                <div className="flex justify-between items-center mt-0.5">
                  <span className={`text-[10px] font-medium ${colors.text}`}>
                    {STATE_LABELS[state] ?? state}
                  </span>
                  <span className="text-[10px] text-text-muted">{Math.round(progress)}%</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
