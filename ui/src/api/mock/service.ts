import type { MigrationRecord, MigrationState, ValidationResult, MigrationPlanResponse } from '../../types';
import {
  MOCK_FLEET,
  MOCK_MIGRATIONS,
  MOCK_AUDIT_EVENTS,
  MOCK_VALIDATION_HISTORY,
  MOCK_QUEUES,
} from './data';

const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms));

// Mutable in-memory state for the mock
const migrations: Record<string, MigrationRecord> = Object.fromEntries(
  MOCK_MIGRATIONS.map((m) => [m.app_id, { ...m }])
);

const MIGRATION_STATES: MigrationState[] = [
  'SNAPSHOTTED',
  'PROVISIONING_TARGET',
  'REWIRING',
  'VALIDATING',
  'MIGRATED',
];

function advanceMigration(appId: string) {
  const m = migrations[appId];
  if (!m) return;
  const idx = MIGRATION_STATES.indexOf(m.state as MigrationState);
  if (idx < 0) {
    m.state = 'SNAPSHOTTED';
  } else if (idx < MIGRATION_STATES.length - 1) {
    const nextState = MIGRATION_STATES[idx + 1];
    m.state = nextState;
    if (nextState === 'MIGRATED') {
      m.completed_at = new Date().toISOString();
      m.validation_results = [
        { phase: 'BASELINE', passed: true, latency_ms: 45 + Math.floor(Math.random() * 20), timestamp: Date.now() - 20000 },
        { phase: 'POST_REWIRE', passed: true, latency_ms: 48 + Math.floor(Math.random() * 20), timestamp: Date.now() - 10000 },
        { phase: 'FINAL', passed: true, latency_ms: 43 + Math.floor(Math.random() * 20), timestamp: Date.now() },
      ];
    }
  }
  // Notify SSE listeners
  sseListeners.forEach((cb) => cb(m));
}

// SSE simulation
type SSECallback = (record: MigrationRecord) => void;
const sseListeners = new Set<SSECallback>();

function simulateMigrationProgress(appId: string) {
  const intervals = [800, 1600, 2400, 3200];
  intervals.forEach((ms) => {
    setTimeout(() => advanceMigration(appId), ms);
  });
}

// Public API mock implementations

export const mockApi = {
  async getFleet() {
    await delay(300);
    return MOCK_FLEET;
  },

  async getQMStatus(qmName: string) {
    await delay(200);
    const qm = MOCK_FLEET.queue_managers.find((q) => q.name === qmName);
    if (!qm) throw new Error(`QM not found: ${qmName}`);
    return qm;
  },

  async getAllMigrations() {
    await delay(250);
    return Object.values(migrations);
  },

  async getMigrationStatus(appId: string) {
    await delay(200);
    const m = migrations[appId];
    if (!m) throw new Error(`Migration not found for app: ${appId}`);
    return m;
  },

  async executeMigration(appId: string, sourceQm: string, targetQm: string) {
    await delay(500);
    migrations[appId] = {
      app_id: appId,
      state: 'SNAPSHOTTED',
      source_qm: sourceQm,
      target_qm: targetQm,
      started_at: new Date().toISOString(),
    };
    sseListeners.forEach((cb) => cb(migrations[appId]));
    simulateMigrationProgress(appId);
  },

  async rollbackMigration(appId: string) {
    await delay(500);
    const m = migrations[appId];
    if (m) {
      m.state = 'ROLLING_BACK';
      sseListeners.forEach((cb) => cb(m));
      setTimeout(() => {
        m.state = 'ROLLED_BACK';
        m.completed_at = new Date().toISOString();
        m.error = 'Manually rolled back via UI';
        sseListeners.forEach((cb) => cb(m));
      }, 1500);
    }
  },

  async getAuditLog(filters: { operation?: string; qm?: string; limit?: number }) {
    await delay(300);
    let events = [...MOCK_AUDIT_EVENTS];
    if (filters.operation) {
      events = events.filter((e) => e.operation.includes(filters.operation!.toUpperCase()));
    }
    if (filters.qm) {
      events = events.filter((e) => e.qm_target.includes(filters.qm!.toUpperCase()));
    }
    return events.slice(0, filters.limit ?? 200);
  },

  async getValidationHistory(appId: string) {
    await delay(200);
    return MOCK_VALIDATION_HISTORY[appId] ?? [];
  },

  async getQueues(qm: string) {
    await delay(200);
    return (MOCK_QUEUES[qm] ?? []).map((name) => ({ name, type: 'LOCAL', depth: Math.floor(Math.random() * 100) }));
  },

  async createQueue(qm: string, name: string, type: string) {
    await delay(600);
    if (!MOCK_QUEUES[qm]) MOCK_QUEUES[qm] = [];
    MOCK_QUEUES[qm].push(name);
    return { qm, name, type, created: true };
  },

  async runBaselineValidation(appId: string, qmName: string, queueName: string) {
    await delay(1200);
    const result: ValidationResult = { phase: 'BASELINE', passed: true, latency_ms: 45 + Math.floor(Math.random() * 30), timestamp: Date.now() };
    if (!MOCK_VALIDATION_HISTORY[appId]) MOCK_VALIDATION_HISTORY[appId] = [];
    MOCK_VALIDATION_HISTORY[appId].push(result);
    return result;
  },

  async getMigrationHistory(appId: string) {
    await delay(200);
    const m = migrations[appId];
    return m ? [m] : [];
  },

  async planMigration(appId: string, sourceQm: string, targetQm: string): Promise<MigrationPlanResponse> {
    await delay(600);
    const safeId = appId.replace('-', '').toUpperCase();
    return {
      app_id: appId,
      source_qm: sourceQm,
      target_qm: targetQm,
      total_steps: 7,
      plan: [
        { step: 1, phase: 'BASELINE_VALIDATION', description: `Validate source flows are operational on ${sourceQm}`, qm: sourceQm, status: 'pending' },
        { step: 2, phase: 'SNAPSHOT', description: `Capture pre-migration topology snapshot of ${sourceQm}`, qm: sourceQm, status: 'pending' },
        { step: 3, phase: 'PROVISION_TARGET', description: `Create target QM ${targetQm} with DLQ Q.${safeId}.DLQ.LOCAL, application queues, channels, and listener`, qm: targetQm, status: 'pending' },
        { step: 4, phase: 'REWIRE', description: `Install xmit queue and remote queue definitions on ${sourceQm} to transparently route traffic to ${targetQm}`, qm: sourceQm, status: 'pending' },
        { step: 5, phase: 'POST_REWIRE_VALIDATION', description: 'Verify transparent routing: producers unchanged, messages reach target', qm: targetQm, status: 'pending' },
        { step: 6, phase: 'CUTOVER', description: `Remove local queue from ${sourceQm} to complete cutover`, qm: sourceQm, status: 'pending' },
        { step: 7, phase: 'FINAL_VALIDATION', description: 'Confirm final state and message delivery on target QM', qm: targetQm, status: 'pending' },
      ],
    };
  },

  // SSE subscription for mock stream
  subscribeSSE(callback: SSECallback): () => void {
    sseListeners.add(callback);
    // Immediately emit current state for all active migrations
    Object.values(migrations).forEach((m) => {
      if (m.state !== 'IDLE') callback(m);
    });
    return () => sseListeners.delete(callback);
  },
};
