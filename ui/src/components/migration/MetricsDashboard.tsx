import { motion } from 'framer-motion';
import { CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, RotateCcw, Clock, Activity, Zap } from 'lucide-react';
import type { MigrationRecord } from '../../types';

interface Props {
  migrations: Record<string, MigrationRecord>;
  apps: Array<{ id: string; source: string; target: string }>;
  autonomousRunning: boolean;
  elapsedSeconds: number;
}

interface MetricTileProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  cssVar: string;
  delay?: number;
}

function MetricTile({ icon, label, value, sub, cssVar, delay = 0 }: MetricTileProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="relative flex flex-col gap-2 px-4 py-4 rounded-xl border bg-surface-card overflow-hidden group hover:-translate-y-0.5 transition-transform duration-200"
      style={{
        borderColor: `color-mix(in srgb, var(${cssVar}) 30%, transparent)`,
        backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0) 100%)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
      }}
    >
      <div
        className="absolute top-0 right-0 w-16 h-16 rounded-full -translate-y-1/2 translate-x-1/2 opacity-20 blur-2xl pointer-events-none"
        style={{ background: `var(${cssVar})` }}
      />

      <div className="flex items-center gap-1.5 text-xs text-text-muted relative z-10">
        <span style={{ color: `var(${cssVar})` }}>{icon}</span>
        <span>{label}</span>
      </div>

      <div
        className="text-2xl font-bold tabular-nums relative z-10"
        style={{ color: `var(${cssVar})` }}
      >
        {value}
      </div>

      {sub && (
        <div className="text-[11px] text-text-muted relative z-10">{sub}</div>
      )}
    </motion.div>
  );
}

export default function MetricsDashboard({ migrations, apps, autonomousRunning, elapsedSeconds }: Props) {
  const records = Object.values(migrations);

  const migrated = records.filter((m) => m.state === 'MIGRATED').length;
  const rolledBack = records.filter((m) => m.state === 'ROLLED_BACK' || m.state === 'ROLLING_BACK').length;
  const active = records.filter((m) =>
    ['SNAPSHOTTED', 'PROVISIONING_TARGET', 'REWIRING', 'VALIDATING'].includes(m.state)
  ).length;

  const validationResults = records.flatMap((m) => m.validation_results ?? []);
  const avgLatency = validationResults.length > 0
    ? Math.round(validationResults.reduce((a, v) => a + v.latency_ms, 0) / validationResults.length)
    : null;

  const successRate = apps.length > 0
    ? Math.round((migrated / apps.length) * 100)
    : 0;

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <MetricTile
        icon={<CheckCircle2 className="w-3.5 h-3.5" />}
        label="Migrated"
        value={migrated}
        sub={`of ${apps.length} apps`}
        cssVar="--accent-success"
        delay={0}
      />
      <MetricTile
        icon={<Activity className="w-3.5 h-3.5" />}
        label="In Progress"
        value={active}
        sub="active migrations"
        cssVar="--accent-warning"
        delay={0.05}
      />
      <MetricTile
        icon={<RotateCcw className="w-3.5 h-3.5" />}
        label="Rolled Back"
        value={rolledBack}
        sub="auto-recovered"
        cssVar="--accent-danger"
        delay={0.1}
      />
      <MetricTile
        icon={<Zap className="w-3.5 h-3.5" />}
        label="Success Rate"
        value={`${successRate}%`}
        sub="completion rate"
        cssVar="--accent-primary"
        delay={0.15}
      />
      <MetricTile
        icon={<Clock className="w-3.5 h-3.5" />}
        label="Avg Latency"
        value={avgLatency !== null ? `${avgLatency}ms` : '—'}
        sub="post-validation p50"
        cssVar="--accent-primary"
        delay={0.2}
      />
      <MetricTile
        icon={<Clock className="w-3.5 h-3.5" />}
        label={autonomousRunning ? 'Elapsed' : 'Total Time'}
        value={elapsedSeconds > 0 ? formatElapsed(elapsedSeconds) : '—'}
        sub={autonomousRunning ? 'autonomous run' : 'last run'}
        cssVar="--text-secondary"
        delay={0.25}
      />
    </div>
  );
}
