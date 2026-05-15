import { create } from 'zustand';
import type { WorkspaceState, WorkspaceStep, WorkspaceTimelineEvent, RuntimeLogEntry, LiveMetric, ValidationPhase, WorkspaceApplication, WorkspaceFlow } from '../types';

const initialState = {
  currentStep: 'app-mapping' as WorkspaceStep,
  selectedAppId: null as string | null,
  selectedFlowId: null as string | null,
  trafficSplit: 0,
  timelineEvents: [] as WorkspaceTimelineEvent[],
  validationPhases: [] as ValidationPhase[],
  runtimeLogs: [] as RuntimeLogEntry[],
  metrics: [] as LiveMetric[],

  // dynamic data
  applications: [] as WorkspaceApplication[],
  flows: [] as WorkspaceFlow[],
  sessionId: null as string | null,
};

export interface ExtendedWorkspaceState extends WorkspaceState {
  applications: WorkspaceApplication[];
  flows: WorkspaceFlow[];
  sessionId: string | null;

  setApplications: (apps: WorkspaceApplication[]) => void;
  setFlows: (flows: WorkspaceFlow[]) => void;
  setMetrics: (metrics: LiveMetric[]) => void;
  setValidationPhases: (phases: ValidationPhase[]) => void;
  setSessionId: (id: string | null) => void;
  appendRuntimeLog: (entry: RuntimeLogEntry) => void;
}

export const useWorkspaceStore = create<ExtendedWorkspaceState>((set) => ({
  ...initialState,

  setStep: (step) => set({ currentStep: step }),
  selectApp: (id) => set({ selectedAppId: id }),
  selectFlow: (id) => set({ selectedFlowId: id }),
  setTrafficSplit: (value) => set({ trafficSplit: value }),

  setApplications: (apps) => set({ applications: apps }),
  setFlows: (flows) => set({ flows }),
  setMetrics: (metrics) => set({ metrics }),
  setValidationPhases: (phases) => set({ validationPhases: phases }),
  setSessionId: (id) => set({ sessionId: id }),

  addTimelineEvent: (event) =>
    set((s) => ({
      timelineEvents: [
        ...s.timelineEvents,
        { ...event, id: `evt-${Date.now()}`, timestamp: Date.now() },
      ],
    })),

  addRuntimeLog: (entry) =>
    set((s) => ({
      runtimeLogs: [...s.runtimeLogs.slice(-99), { ...entry, timestamp: Date.now() }],
    })),

  appendRuntimeLog: (entry) =>
    set((s) => ({
      runtimeLogs: [...s.runtimeLogs.slice(-99), entry],
    })),

  resetWorkspace: () => set(initialState),
}));
