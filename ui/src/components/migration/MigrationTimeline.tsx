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
  IDLE:                'Idle',
  SNAPSHOTTED:         'Snapshotted',
  PROVISIONING_TARGET: 'Provisioning',
  REWIRING:            'Rewiring',
  VALIDATING:          'Validating',
  MIGRATED:            'Migrated',
  ROLLING_BACK:        'Rolling Back',
  ROLLED_BACK:         'Rolled Back',
};

export default function MigrationTimeline({ apps, migrations, currentAppId }: Props) {
  return (
    <div
      className="rounded-xl border border-surface-border overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 100%)',
        backgroundColor: '#141B2D',
        boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b border-surface-border"
        style={{ background: 'rgba(10,14,26,0.4)' }}
      >
        <div className="section-title">Migration Progress Overview</div>
        <div className="flex items-center gap-3">
          {STATE_ORDER.filter((s) => s !== 'IDLE').map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: STATE_COLORS[s].dot }}
              />
              <span className="text-[10px] text-text-muted">{STATE_LABELS[s]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div className="px-5 py-3 space-y-3">
        {apps.map(({ id }) => {
          const record = migrations[id];
          const state = record?.state ?? 'IDLE';
          const isCurrent = currentAppId === id;
          const stateIdx = STATE_ORDER.indexOf(state);
          const progress = state === 'IDLE' ? 0
            : state === 'ROLLED_BACK' || state === 'ROLLING_BACK' ? 15
            : ((stateIdx / (STATE_ORDER.length - 1)) * 100);
          const colors = STATE_COLORS[state];

          return (
            <motion.div
              key={id}
              layout
              className="flex items-center gap-4 px-3 py-2 rounded-xl transition-all duration-200"
              style={
                isCurrent
                  ? { background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }
                  : { background: 'transparent' }
              }
            >
              {/* App label */}
              <div className="flex items-center gap-1.5 w-14 shrink-0">
                {isCurrent && (
                  <motion.div
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 0.9, repeat: Infinity }}
                  >
                    <Zap className="w-3 h-3" style={{ color: '#22C55E' }} />
                  </motion.div>
                )}
                <span
                  className="text-xs font-mono font-semibold"
                  style={{ color: isCurrent ? '#22C55E' : '#9CA3AF' }}
                >
                  {id}
                </span>
              </div>

              {/* Phase dot trail */}
              <div className="flex-1 flex items-center gap-0.5">
                {STATE_ORDER.map((s, i) => {
                  const isActivePhase = s === state;
                  const isPast = i < stateIdx;
                  const isFuture = i > stateIdx;
                  const dotColor = isActivePhase || isPast ? colors.dot : '#1A2236';

                  return (
                    <div key={s} className="flex items-center flex-1">
                      <motion.div
                        className="relative flex items-center justify-center"
                        animate={isActivePhase ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                        transition={isActivePhase ? { duration: 1.3, repeat: Infinity } : {}}
                      >
                        {/* Glow ring for active */}
                        {isActivePhase && (
                          <span
                            className="absolute inset-0 rounded-full animate-ping"
                            style={{
                              backgroundColor: colors.dot,
                              opacity: 0.35,
                              width: '10px',
                              height: '10px',
                              top: '-1px',
                              left: '-1px',
                            }}
                          />
                        )}
                        <div
                          className="w-2 h-2 rounded-full transition-all duration-500"
                          style={{
                            backgroundColor: dotColor,
                            opacity: isFuture ? 0.2 : 1,
                            boxShadow: isActivePhase ? `0 0 6px ${colors.dot}` : 'none',
                          }}
                        />
                      </motion.div>
                      {i < STATE_ORDER.length - 1 && (
                        <div
                          className="flex-1 h-px mx-0.5 transition-all duration-500"
                          style={{
                            backgroundColor: i < stateIdx ? colors.dot : '#1A2236',
                            opacity: i >= stateIdx ? 0.25 : 0.7,
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Progress bar + label */}
              <div className="w-28 shrink-0">
                <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: '#1A2236' }}>
                  <motion.div
                    className="h-full rounded-full"
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    style={{
                      backgroundColor: colors.dot,
                      boxShadow: progress > 0 ? `0 0 6px ${colors.dot}` : 'none',
                    }}
                  />
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[10px] font-medium" style={{ color: colors.dot }}>
                    {STATE_LABELS[state] ?? state}
                  </span>
                  <span className="text-[10px] text-text-muted tabular-nums">{Math.round(progress)}%</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
