import type { MigrationState } from '../types';

export const STATE_COLORS: Record<MigrationState, {
  bg: string;
  text: string;
  dot: string;
  ring: string;
  border: string;
}> = {
  IDLE:                 { bg: 'bg-slate-100',    text: 'text-slate-600',   dot: '#94a3b8', ring: '#e2e8f0', border: 'border-slate-200' },
  SNAPSHOTTED:          { bg: 'bg-blue-100',     text: 'text-blue-700',    dot: '#3b82f6', ring: '#bfdbfe', border: 'border-blue-200' },
  PROVISIONING_TARGET:  { bg: 'bg-amber-100',    text: 'text-amber-700',   dot: '#f59e0b', ring: '#fde68a', border: 'border-amber-200' },
  REWIRING:             { bg: 'bg-amber-100',    text: 'text-amber-700',   dot: '#f59e0b', ring: '#fde68a', border: 'border-amber-200' },
  VALIDATING:           { bg: 'bg-sky-100',      text: 'text-sky-700',     dot: '#0ea5e9', ring: '#bae6fd', border: 'border-sky-200' },
  MIGRATED:             { bg: 'bg-emerald-100',  text: 'text-emerald-700', dot: '#10b981', ring: '#a7f3d0', border: 'border-emerald-200' },
  ROLLING_BACK:         { bg: 'bg-red-100',      text: 'text-red-700',     dot: '#ef4444', ring: '#fecaca', border: 'border-red-200' },
  ROLLED_BACK:          { bg: 'bg-orange-100',   text: 'text-orange-700',  dot: '#f97316', ring: '#fed7aa', border: 'border-orange-200' },
};

export const PULSING_STATES: MigrationState[] = [
  'PROVISIONING_TARGET', 'REWIRING', 'VALIDATING', 'ROLLING_BACK',
];
