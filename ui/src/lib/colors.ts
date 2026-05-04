import type { MigrationState } from '../types';

export const STATE_COLORS: Record<MigrationState, {
  bg: string;
  text: string;
  dot: string;
  ring: string;
  border: string;
}> = {
  IDLE:                 { bg: 'bg-surface-muted/40',   text: 'text-text-secondary',  dot: '#6B7280', ring: '#374151', border: 'border-surface-border' },
  SNAPSHOTTED:          { bg: 'bg-blue-900/30',        text: 'text-blue-300',         dot: '#3b82f6', ring: '#1e3a5f', border: 'border-blue-800' },
  PROVISIONING_TARGET:  { bg: 'bg-amber-900/30',       text: 'text-amber-300',        dot: '#f59e0b', ring: '#451a03', border: 'border-amber-800' },
  REWIRING:             { bg: 'bg-amber-900/30',       text: 'text-amber-300',        dot: '#f59e0b', ring: '#451a03', border: 'border-amber-800' },
  VALIDATING:           { bg: 'bg-cyan-900/30',        text: 'text-cyan-300',         dot: '#06b6d4', ring: '#164e63', border: 'border-cyan-800' },
  MIGRATED:             { bg: 'bg-emerald-900/30',     text: 'text-emerald-300',      dot: '#10b981', ring: '#022c22', border: 'border-emerald-800' },
  ROLLING_BACK:         { bg: 'bg-red-900/30',         text: 'text-red-300',          dot: '#ef4444', ring: '#450a0a', border: 'border-red-800' },
  ROLLED_BACK:          { bg: 'bg-orange-900/30',      text: 'text-orange-300',       dot: '#f97316', ring: '#431407', border: 'border-orange-800' },
};

export const PULSING_STATES: MigrationState[] = [
  'PROVISIONING_TARGET', 'REWIRING', 'VALIDATING', 'ROLLING_BACK',
];
