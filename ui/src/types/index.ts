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

export interface QueueManager {
  name: string;
  internal_name: string;
  svc_url: string;
  role: 'source' | 'target';
  status?: 'reachable' | 'unreachable' | 'unknown';
}

export interface Fleet {
  queue_managers: QueueManager[];
}

export interface AuditEvent {
  timestamp: number;
  operation: string;
  qm_target: string;
  agent: string;
  result: string;
  trace_id?: string;
  details?: Record<string, unknown>;
}

export interface SSEMigrationEvent {
  app_id: string;
  state: MigrationState;
  timestamp: string;
  error?: string;
}
