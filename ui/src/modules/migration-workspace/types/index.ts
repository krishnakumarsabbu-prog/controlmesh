// ── Migration Workspace domain types ──────────────────────────────────────────

export type WorkspaceStep =
  | 'app-mapping'
  | 'source-validation'
  | 'config-redeploy'
  | 'target-validation'
  | 'summary';

export const WORKSPACE_STEPS: { id: WorkspaceStep; label: string; step: number }[] = [
  { id: 'app-mapping',        label: 'App Mapping',       step: 1 },
  { id: 'source-validation',  label: 'Source Validation', step: 2 },
  { id: 'config-redeploy',    label: 'Config & Redeploy', step: 3 },
  { id: 'target-validation',  label: 'Target Validation', step: 4 },
  { id: 'summary',            label: 'Summary',           step: 5 },
];

export interface WorkspaceApplication {
  id: string;
  name: string;
  environment: string;
  domain: string;
  producers: WorkspaceService[];
  consumers: WorkspaceService[];
  status: 'healthy' | 'degraded' | 'error';
}

export interface WorkspaceService {
  id: string;
  name: string;
  type: 'producer' | 'consumer';
  qm: string;
  queue: string;
  tps: number;
  status: 'healthy' | 'degraded' | 'error';
}

export interface WorkspaceFlow {
  id: string;
  name: string;
  appId: string;
  sourceQM: string;
  targetQM: string;
  activePath: 'source' | 'target' | 'both';
  trafficSplit: number; // 0-100, percentage on target
  status: 'idle' | 'validating' | 'migrating' | 'migrated' | 'failed';
}

export interface ValidationCheckResult {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'warning';
  detail?: string;
  latency?: number;
}

export interface ValidationPhase {
  id: string;
  label: string;
  checks: ValidationCheckResult[];
  startedAt?: number;
  completedAt?: number;
}

export interface RuntimeLogEntry {
  timestamp: number;
  level: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  service: string;
  message: string;
}

export interface LiveMetric {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  color?: 'cyan' | 'green' | 'amber' | 'red';
}

export interface WorkspaceTimelineEvent {
  id: string;
  timestamp: number;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  detail?: string;
  step: WorkspaceStep;
}

export interface WorkspaceState {
  currentStep: WorkspaceStep;
  selectedAppId: string | null;
  selectedFlowId: string | null;
  trafficSplit: number;
  timelineEvents: WorkspaceTimelineEvent[];
  validationPhases: ValidationPhase[];
  runtimeLogs: RuntimeLogEntry[];
  metrics: LiveMetric[];

  setStep: (step: WorkspaceStep) => void;
  selectApp: (id: string | null) => void;
  selectFlow: (id: string | null) => void;
  setTrafficSplit: (value: number) => void;
  addTimelineEvent: (event: Omit<WorkspaceTimelineEvent, 'id' | 'timestamp'>) => void;
  addRuntimeLog: (entry: Omit<RuntimeLogEntry, 'timestamp'>) => void;
  resetWorkspace: () => void;
}
