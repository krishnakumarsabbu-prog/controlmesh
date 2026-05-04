// ── Core domain models ────────────────────────────────────────────────────────

export interface Application {
  id: string;
  name: string;
}

export interface Queue {
  id: string;
  name: string;
  type: 'local' | 'remote';
}

export interface QueueManager {
  id: string;
  name: string;
  queues: Queue[];
}

export interface Channel {
  id: string;
  sourceQM: string;
  targetQM: string;
}

export interface Topology {
  applications: Application[];
  queueManagers: QueueManager[];
  channels: Channel[];
}

export type MigrationStepStatus = 'pending' | 'running' | 'success' | 'failed';

export interface MigrationStep {
  id: string;
  action: string;
  status: MigrationStepStatus;
}

export interface MigrationPlan {
  steps: MigrationStep[];
}

// ── Migration state machine ───────────────────────────────────────────────────

export type MigrationState =
  | 'IDLE'
  | 'SNAPSHOTTED'
  | 'PROVISIONING_TARGET'
  | 'REWIRING'
  | 'VALIDATING'
  | 'MIGRATED'
  | 'ROLLING_BACK'
  | 'ROLLED_BACK';

export interface MigrationRecord {
  app_id: string;
  state: MigrationState;
  source_qm: string;
  target_qm: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
  validation_results?: ValidationResult[];
}

export interface ValidationResult {
  phase: 'BASELINE' | 'POST_REWIRE' | 'FINAL';
  passed: boolean;
  latency_ms: number;
  timestamp?: number;
  details?: string;
}

// ── Fleet / connectivity ──────────────────────────────────────────────────────

export interface QueueManagerFleet {
  name: string;
  internal_name: string;
  svc_url: string;
  role: 'source' | 'target';
  status?: 'reachable' | 'unreachable' | 'unknown';
}

export interface Fleet {
  queue_managers: QueueManagerFleet[];
}

// ── Audit ─────────────────────────────────────────────────────────────────────

export interface AuditEvent {
  timestamp: number;
  operation: string;
  qm_target: string;
  agent: string;
  result: string;
  trace_id?: string;
  details?: Record<string, unknown>;
}

// ── SSE events ────────────────────────────────────────────────────────────────

export interface SSEMigrationEvent {
  app_id: string;
  state: MigrationState;
  timestamp: string;
  error?: string;
}
