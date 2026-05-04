import type { MigrationState } from '../types';

export const STATE_COLORS: Record<MigrationState, {
  bg: string;
  text: string;
  dot: string;
  ring: string;
  border: string;
  glow: string;
}> = {
  IDLE:                 { bg: 'bg-surface-muted/30',    text: 'text-text-muted',       dot: '#4B5563', ring: '#374151', border: 'border-surface-border', glow: 'transparent'               },
  SNAPSHOTTED:          { bg: 'bg-indigo-900/25',       text: 'text-indigo-300',        dot: '#6366F1', ring: '#312e81', border: 'border-indigo-800/60',  glow: 'rgba(99,102,241,0.35)'    },
  PROVISIONING_TARGET:  { bg: 'bg-amber-900/25',        text: 'text-amber-300',         dot: '#F59E0B', ring: '#451a03', border: 'border-amber-800/60',   glow: 'rgba(245,158,11,0.35)'    },
  REWIRING:             { bg: 'bg-amber-900/25',        text: 'text-amber-300',         dot: '#F59E0B', ring: '#451a03', border: 'border-amber-800/60',   glow: 'rgba(245,158,11,0.35)'    },
  VALIDATING:           { bg: 'bg-cyan-900/25',         text: 'text-cyan-300',          dot: '#06B6D4', ring: '#164e63', border: 'border-cyan-800/60',    glow: 'rgba(6,182,212,0.35)'     },
  MIGRATED:             { bg: 'bg-green-900/25',        text: 'text-green-300',         dot: '#22C55E', ring: '#14532d', border: 'border-green-800/60',   glow: 'rgba(34,197,94,0.35)'     },
  ROLLING_BACK:         { bg: 'bg-red-900/25',          text: 'text-red-300',           dot: '#EF4444', ring: '#450a0a', border: 'border-red-800/60',     glow: 'rgba(239,68,68,0.35)'     },
  ROLLED_BACK:          { bg: 'bg-orange-900/25',       text: 'text-orange-300',        dot: '#F97316', ring: '#431407', border: 'border-orange-800/60',  glow: 'rgba(249,115,22,0.35)'    },
};

export const PULSING_STATES: MigrationState[] = [
  'PROVISIONING_TARGET', 'REWIRING', 'VALIDATING', 'ROLLING_BACK',
];
