import { create } from 'zustand';
import type { MigrationRecord, Fleet } from '../types';
import type { TopologyGraph } from '../api/topologyUpload';

interface AppState {
  migrations: Record<string, MigrationRecord>;
  fleet: Fleet | null;
  sseConnected: boolean;
  theme: 'standard' | 'sentinel' | 'editorial';
  sourceTopology: TopologyGraph | null;
  targetTopology: TopologyGraph | null;
  setMigration: (record: MigrationRecord) => void;
  setMigrations: (records: MigrationRecord[]) => void;
  setFleet: (fleet: Fleet) => void;
  setSseConnected: (connected: boolean) => void;
  setTheme: (theme: 'standard' | 'sentinel' | 'editorial') => void;
  setSourceTopology: (graph: TopologyGraph | null) => void;
  setTargetTopology: (graph: TopologyGraph | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  migrations: {},
  fleet: null,
  sseConnected: false,
  theme: 'standard',
  sourceTopology: null,
  targetTopology: null,
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
  setTheme: (theme) => {
    const root = document.documentElement;
    root.classList.remove('theme-sentinel', 'theme-editorial');
    if (theme === 'sentinel') root.classList.add('theme-sentinel');
    else if (theme === 'editorial') root.classList.add('theme-editorial');
    set({ theme });
  },
  setSourceTopology: (graph) => set({ sourceTopology: graph }),
  setTargetTopology: (graph) => set({ targetTopology: graph }),
}));
