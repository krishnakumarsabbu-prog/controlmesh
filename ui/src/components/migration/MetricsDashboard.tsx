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
  accent: string;
  delay?: number;
}

function MetricTile({ icon, label, value, sub, accent, delay = 0 }: MetricTileProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={`flex flex-col gap-1 px-4 py-3 rounded-xl border ${accent} bg-surface-card`}
    >
      <div className="flex items-center gap-1.5 text-xs text-text-muted">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold text-text-primary tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-text-muted">{sub}</div>}
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
    ? Math.round(((migrated) / apps.length) * 100)
    : 0;

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <MetricTile
        icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
        label="Migrated"
        value={migrated}
        sub={`of ${apps.length} apps`}
        accent="border-emerald-800"
        delay={0}
      />
      <MetricTile
        icon={<Activity className="w-3.5 h-3.5 text-amber-400" />}
        label="In Progress"
        value={active}
        sub="active migrations"
        accent="border-amber-800"
        delay={0.05}
      />
      <MetricTile
        icon={<RotateCcw className="w-3.5 h-3.5 text-red-400" />}
        label="Rolled Back"
        value={rolledBack}
        sub="auto-recovered"
        accent="border-red-800"
        delay={0.1}
      />
      <MetricTile
        icon={<Zap className="w-3.5 h-3.5 text-sky-400" />}
        label="Success Rate"
        value={`${successRate}%`}
        sub="completion rate"
        accent="border-sky-800"
        delay={0.15}
      />
      <MetricTile
        icon={<Clock className="w-3.5 h-3.5 text-cyan-400" />}
        label="Avg Latency"
        value={avgLatency !== null ? `${avgLatency}ms` : '—'}
        sub="post-validation p50"
        accent="border-cyan-800"
        delay={0.2}
      />
      <MetricTile
        icon={<Clock className="w-3.5 h-3.5 text-slate-400" />}
        label={autonomousRunning ? 'Elapsed' : 'Total Time'}
        value={elapsedSeconds > 0 ? formatElapsed(elapsedSeconds) : '—'}
        sub={autonomousRunning ? 'autonomous run' : 'last run'}
        accent="border-surface-border"
        delay={0.25}
      />
    </div>
  );
}
