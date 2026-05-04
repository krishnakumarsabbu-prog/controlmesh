import type { MigrationRecord, Fleet, AuditEvent, ValidationResult } from '../../types';

const now = Date.now();
const t = (offsetSec: number) => now - offsetSec * 1000;

export const MOCK_FLEET: Fleet = {
  queue_managers: [
    { name: 'QM.SRC.A', internal_name: 'qmsrca', svc_url: 'http://qmsrca:9443', role: 'source', status: 'reachable' },
    { name: 'QM.SRC.B', internal_name: 'qmsrcb', svc_url: 'http://qmsrcb:9443', role: 'source', status: 'reachable' },
    { name: 'QM.APP1', internal_name: 'qmapp1', svc_url: 'http://qmapp1:9443', role: 'target', status: 'reachable' },
    { name: 'QM.APP2', internal_name: 'qmapp2', svc_url: 'http://qmapp2:9443', role: 'target', status: 'reachable' },
    { name: 'QM.APP3', internal_name: 'qmapp3', svc_url: 'http://qmapp3:9443', role: 'target', status: 'reachable' },
    { name: 'QM.APP4', internal_name: 'qmapp4', svc_url: 'http://qmapp4:9443', role: 'target', status: 'unknown' },
    { name: 'QM.APP5', internal_name: 'qmapp5', svc_url: 'http://qmapp5:9443', role: 'target', status: 'unknown' },
    { name: 'QM.APP6', internal_name: 'qmapp6', svc_url: 'http://qmapp6:9443', role: 'target', status: 'unknown' },
  ],
};

const validationResults = (passed: boolean, latencyBase: number): ValidationResult[] => [
  { phase: 'BASELINE', passed: true, latency_ms: latencyBase + 3, timestamp: t(600) },
  { phase: 'POST_REWIRE', passed: passed, latency_ms: latencyBase + 8, timestamp: t(300) },
  { phase: 'FINAL', passed: passed, latency_ms: latencyBase + 2, timestamp: t(100) },
];

export const MOCK_MIGRATIONS: MigrationRecord[] = [
  {
    app_id: 'APP1',
    state: 'MIGRATED',
    source_qm: 'QM.SRC.A',
    target_qm: 'QM.APP1',
    started_at: new Date(t(900)).toISOString(),
    completed_at: new Date(t(300)).toISOString(),
    validation_results: validationResults(true, 42),
  },
  {
    app_id: 'APP2',
    state: 'ROLLED_BACK',
    source_qm: 'QM.SRC.A',
    target_qm: 'QM.APP2',
    started_at: new Date(t(700)).toISOString(),
    completed_at: new Date(t(500)).toISOString(),
    error: 'Validation failed: latency exceeded threshold (850ms > 500ms)',
    validation_results: validationResults(false, 780),
  },
  {
    app_id: 'APP3',
    state: 'VALIDATING',
    source_qm: 'QM.SRC.B',
    target_qm: 'QM.APP3',
    started_at: new Date(t(120)).toISOString(),
    validation_results: [
      { phase: 'BASELINE', passed: true, latency_ms: 55, timestamp: t(110) },
    ],
  },
  {
    app_id: 'APP4',
    state: 'PROVISIONING_TARGET',
    source_qm: 'QM.SRC.B',
    target_qm: 'QM.APP4',
    started_at: new Date(t(60)).toISOString(),
  },
  {
    app_id: 'APP5',
    state: 'IDLE',
    source_qm: 'QM.SRC.B',
    target_qm: 'QM.APP5',
  },
  {
    app_id: 'APP6',
    state: 'IDLE',
    source_qm: 'QM.SRC.B',
    target_qm: 'QM.APP6',
  },
];

const OPERATIONS = [
  'SNAPSHOT_QUEUES',
  'PROVISION_TARGET_QM',
  'CREATE_QUEUE',
  'REWIRE_CHANNEL',
  'VALIDATE_LATENCY',
  'FINALIZE_MIGRATION',
  'ROLLBACK_REWIRE',
  'AUDIT_POLICY_CHECK',
];

const AGENTS = ['bcl-orchestrator', 'bcl-migration-agent', 'bcl-validation-agent', 'bcl-rollback-agent'];
const QMS = ['QM.SRC.A', 'QM.SRC.B', 'QM.APP1', 'QM.APP2', 'QM.APP3', 'QM.APP4'];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function hex(n: number): string {
  return Math.random().toString(16).slice(2, 2 + n);
}

export const MOCK_AUDIT_EVENTS: AuditEvent[] = Array.from({ length: 40 }, (_, i) => ({
  timestamp: t(i * 45 + Math.floor(Math.random() * 20)),
  operation: randomFrom(OPERATIONS),
  qm_target: randomFrom(QMS),
  agent: randomFrom(AGENTS),
  result: i % 7 === 0 ? 'failure' : 'success',
  trace_id: hex(8) + '-' + hex(4) + '-' + hex(4) + '-' + hex(8),
  details: { duration_ms: 200 + Math.floor(Math.random() * 800) },
}));

export const MOCK_VALIDATION_HISTORY: Record<string, ValidationResult[]> = {
  APP1: validationResults(true, 42),
  APP2: validationResults(false, 780),
  APP3: [
    { phase: 'BASELINE', passed: true, latency_ms: 55, timestamp: t(110) },
  ],
  APP4: [],
  APP5: [],
  APP6: [],
};

export const MOCK_QUEUES: Record<string, string[]> = {
  'QM.SRC.A': ['APP1.REQUEST.Q', 'APP1.REPLY.Q', 'APP2.REQUEST.Q', 'APP2.REPLY.Q'],
  'QM.SRC.B': ['APP3.REQUEST.Q', 'APP3.REPLY.Q', 'APP4.REQUEST.Q', 'APP5.REQUEST.Q', 'APP6.REQUEST.Q'],
  'QM.APP1': ['APP1.REQUEST.Q', 'APP1.REPLY.Q'],
  'QM.APP2': [],
  'QM.APP3': ['APP3.REQUEST.Q'],
  'QM.APP4': [],
  'QM.APP5': [],
  'QM.APP6': [],
};
