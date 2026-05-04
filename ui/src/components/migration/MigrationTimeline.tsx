import { STATE_COLORS } from '../../lib/colors';
import type { MigrationRecord, MigrationState } from '../../types';

interface AppConfig { id: string; source: string; target: string; }

interface Props {
  apps: AppConfig[];
  migrations: Record<string, MigrationRecord>;
}

const STATE_ORDER: MigrationState[] = [
  'IDLE', 'SNAPSHOTTED', 'PROVISIONING_TARGET', 'REWIRING', 'VALIDATING', 'MIGRATED',
];

export default function MigrationTimeline({ apps, migrations }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
        Migration Progress Overview
      </div>
      <div className="space-y-3">
        {apps.map(({ id }) => {
          const record = migrations[id];
          const state = record?.state ?? 'IDLE';
          const progress = state === 'IDLE' ? 0
            : state === 'ROLLED_BACK' || state === 'ROLLING_BACK' ? 20
            : ((STATE_ORDER.indexOf(state) / (STATE_ORDER.length - 1)) * 100);
          const colors = STATE_COLORS[state];

          return (
            <div key={id} className="flex items-center gap-3">
              <span className="text-xs font-mono font-semibold text-slate-600 w-12 shrink-0">{id}</span>
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${progress}%`,
                    backgroundColor: colors.dot,
                  }}
                />
              </div>
              <span className={`text-[11px] font-medium w-28 text-right shrink-0 ${colors.text}`}>
                {state.replace('_', ' ')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
