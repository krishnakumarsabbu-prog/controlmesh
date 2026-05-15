import { create } from 'zustand';
import type { WorkspaceState, WorkspaceStep, WorkspaceTimelineEvent, RuntimeLogEntry } from '../types';
import { MOCK_LIVE_METRICS, MOCK_TIMELINE_EVENTS, MOCK_RUNTIME_LOGS, MOCK_VALIDATION_PHASES } from '../mock/data';

const initialState = {
  currentStep: 'app-mapping' as WorkspaceStep,
  selectedAppId: null as string | null,
  selectedFlowId: null as string | null,
  trafficSplit: 0,
  timelineEvents: MOCK_TIMELINE_EVENTS,
  validationPhases: MOCK_VALIDATION_PHASES,
  runtimeLogs: MOCK_RUNTIME_LOGS,
  metrics: MOCK_LIVE_METRICS,
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  ...initialState,

  setStep: (step) => set({ currentStep: step }),

  selectApp: (id) => set({ selectedAppId: id }),

  selectFlow: (id) => set({ selectedFlowId: id }),

  setTrafficSplit: (value) => set({ trafficSplit: value }),

  addTimelineEvent: (event) =>
    set((s) => ({
      timelineEvents: [
        ...s.timelineEvents,
        { ...event, id: `evt-${Date.now()}`, timestamp: Date.now() },
      ],
    })),

  addRuntimeLog: (entry) =>
    set((s) => ({
      runtimeLogs: [
        ...s.runtimeLogs,
        { ...entry, timestamp: Date.now() },
      ],
    })),

  resetWorkspace: () => set(initialState),
}));
