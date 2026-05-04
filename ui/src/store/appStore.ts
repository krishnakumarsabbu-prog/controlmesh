import { create } from 'zustand';
import type { MigrationRecord, Fleet } from '../types';

interface AppState {
  migrations: Record<string, MigrationRecord>;
  fleet: Fleet | null;
  sseConnected: boolean;
  theme: 'standard' | 'sentinel';
  setMigration: (record: MigrationRecord) => void;
  setMigrations: (records: MigrationRecord[]) => void;
  setFleet: (fleet: Fleet) => void;
  setSseConnected: (connected: boolean) => void;
  setTheme: (theme: 'standard' | 'sentinel') => void;
}

export const useAppStore = create<AppState>((set) => ({
  migrations: {},
  fleet: null,
  sseConnected: false,
  theme: 'standard',
  setMigration: (record) =>
    set((state) => ({
      migrations: { ...state.migrations, [record.app_id]: record },
    })),
  setMigrations: (records) =>
    set(() => ({
      migrations: Object.fromEntries(records.map((r) => [r.app_id, r])),
    })),
  setFleet: (fleet) => set({ fleet }),
  setSseConnected: (sseConnected) => set({ sseConnected }),
  setTheme: (theme) => set({ theme }),
}));
