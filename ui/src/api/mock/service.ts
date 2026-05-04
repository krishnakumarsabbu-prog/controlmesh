import type { MigrationRecord, MigrationState, MigrationPlanStep, ValidationResult, MigrationPlanResponse, TopologyChannel } from '../../types';
import {
  MOCK_FLEET,
  MOCK_MIGRATIONS,
  MOCK_AUDIT_EVENTS,
  MOCK_VALIDATION_HISTORY,
  MOCK_QUEUES,
  MOCK_QUEUES_BY_STATE,
  MOCK_CHANNELS,
} from './data';

const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms));

// Mutable in-memory state for the mock
const migrations: Record<string, MigrationRecord> = Object.fromEntries(
  MOCK_MIGRATIONS.map((m) => [m.app_id, { ...m }])
);

// Per-app plan step state for real-time step execution
const migrationPlanSteps: Record<string, MigrationPlanStep[]> = {};

const MIGRATION_STATES: MigrationState[] = [
  'SNAPSHOTTED',
  'PROVISIONING_TARGET',
  'REWIRING',
  'VALIDATING',
  'MIGRATED',
];

// Step index ranges mapped to migration states (7 plan steps across 4 active states + migrated)
const STEP_STATE_MAP: [number, number, MigrationState][] = [
  [0, 1, 'SNAPSHOTTED'],           // steps 1-2
  [2, 2, 'PROVISIONING_TARGET'],   // step 3
  [3, 3, 'REWIRING'],              // step 4
  [4, 5, 'VALIDATING'],            // steps 5-6
  [6, 6, 'MIGRATED'],              // step 7
];

function getStateForStep(stepIdx: number): MigrationState {
  for (const [start, end, state] of STEP_STATE_MAP) {
    if (stepIdx >= start && stepIdx <= end) return state;
  }
  return 'MIGRATED';
}

function buildDefaultPlan(appId: string, sourceQm: string, targetQm: string): MigrationPlanStep[] {
  const safeId = appId.replace('-', '').toUpperCase();
  return [
    { step: 1, phase: 'BASELINE_VALIDATION', description: `Validate source flows are operational on ${sourceQm}`, qm: sourceQm, status: 'pending' },
    { step: 2, phase: 'SNAPSHOT', description: `Capture pre-migration topology snapshot of ${sourceQm}`, qm: sourceQm, status: 'pending' },
    { step: 3, phase: 'PROVISION_TARGET', description: `Create target QM ${targetQm} with DLQ Q.${safeId}.DLQ.LOCAL, application queues, channels, and listener`, qm: targetQm, status: 'pending' },
    { step: 4, phase: 'REWIRE', description: `Install xmit queue and remote queue definitions on ${sourceQm} to transparently route traffic to ${targetQm}`, qm: sourceQm, status: 'pending' },
    { step: 5, phase: 'POST_REWIRE_VALIDATION', description: 'Verify transparent routing: producers unchanged, messages reach target', qm: targetQm, status: 'pending' },
    { step: 6, phase: 'CUTOVER', description: `Remove local queue from ${sourceQm} to complete cutover`, qm: sourceQm, status: 'pending' },
    { step: 7, phase: 'FINAL_VALIDATION', description: 'Confirm final state and message delivery on target QM', qm: targetQm, status: 'pending' },
  ];
}

// SSE simulation
type SSECallback = (record: MigrationRecord) => void;
type StepSSECallback = (appId: string, steps: MigrationPlanStep[]) => void;
const sseListeners = new Set<SSECallback>();
const stepListeners = new Set<StepSSECallback>();

function notifyStepListeners(appId: string) {
  const steps = migrationPlanSteps[appId];
  if (steps) stepListeners.forEach((cb) => cb(appId, steps));
}

async function simulateMigrationProgress(appId: string) {
  const steps = migrationPlanSteps[appId];
  if (!steps) return;

  for (let i = 0; i < steps.length; i++) {
    // Mark current step as running
    steps[i] = { ...steps[i], status: 'running' };
    notifyStepListeners(appId);

    // Advance migration state machine at appropriate step boundaries
    const newMigrationState = getStateForStep(i);
    const m = migrations[appId];
    if (m && m.state !== newMigrationState) {
      m.state = newMigrationState;
      if (newMigrationState === 'MIGRATED') {
        m.completed_at = new Date().toISOString();
        m.validation_results = [
          { phase: 'BASELINE', passed: true, latency_ms: 45 + Math.floor(Math.random() * 20), timestamp: Date.now() - 20000 },
          { phase: 'POST_REWIRE', passed: true, latency_ms: 48 + Math.floor(Math.random() * 20), timestamp: Date.now() - 10000 },
          { phase: 'FINAL', passed: true, latency_ms: 43 + Math.floor(Math.random() * 20), timestamp: Date.now() },
        ];
      }
      sseListeners.forEach((cb) => cb(m));
    }

    // Wait 1 second per step
    await new Promise((r) => setTimeout(r, 1000));

    // Mark current step as success
    steps[i] = { ...steps[i], status: 'success' };
    notifyStepListeners(appId);
  }

  // Ensure final state is MIGRATED
  const m = migrations[appId];
  if (m && m.state !== 'MIGRATED') {
    m.state = 'MIGRATED';
    m.completed_at = new Date().toISOString();
    sseListeners.forEach((cb) => cb(m));
  }
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
    // Reset plan steps to pending
    migrationPlanSteps[appId] = buildDefaultPlan(appId, sourceQm, targetQm);
    notifyStepListeners(appId);
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
    // Return live steps if we have them (from an active/completed execution)
    const liveSteps = migrationPlanSteps[appId];
    const plan = liveSteps ?? buildDefaultPlan(appId, sourceQm, targetQm);
    return {
      app_id: appId,
      source_qm: sourceQm,
      target_qm: targetQm,
      total_steps: 7,
      plan,
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

  // Subscribe to real-time plan step updates for a specific app
  subscribePlanSteps(appId: string, callback: (steps: MigrationPlanStep[]) => void): () => void {
    const wrapper: StepSSECallback = (id, steps) => {
      if (id === appId) callback(steps);
    };
    stepListeners.add(wrapper);
    // Emit current steps immediately if available
    const current = migrationPlanSteps[appId];
    if (current) callback(current);
    return () => stepListeners.delete(wrapper);
  },

  getPlanSteps(appId: string): MigrationPlanStep[] | null {
    return migrationPlanSteps[appId] ?? null;
  },

  // Returns queues with type info, reflecting current migration state for a QM
  async getQueueDetails(qmName: string): Promise<Array<{ name: string; type: 'local' | 'remote' | 'xmit'; remoteQM?: string }>> {
    await delay(150);
    const byState = MOCK_QUEUES_BY_STATE[qmName];
    if (!byState) {
      // Target QMs — derive from MOCK_QUEUES, all local
      const names = MOCK_QUEUES[qmName] ?? [];
      return names.map((n) => ({ name: n, type: 'local' as const }));
    }
    // Pick the state that represents the most advanced active migration on this QM
    const relevantMigrations = Object.values(migrations).filter(
      (m) => m.source_qm === qmName
    );
    const dominantState = relevantMigrations.find((m) => m.state === 'REWIRING')?.state
      ?? relevantMigrations.find((m) => m.state === 'MIGRATED')?.state
      ?? relevantMigrations.find((m) => m.state === 'VALIDATING')?.state
      ?? 'IDLE';
    return byState[dominantState] ?? byState['IDLE'] ?? [];
  },

  // Returns active channels reflecting rewiring state
  async getActiveChannels(): Promise<TopologyChannel[]> {
    await delay(150);
    // Only return channels for active or completed migrations
    return MOCK_CHANNELS.filter((ch) => {
      const relevantMigration = Object.values(migrations).find(
        (m) => m.source_qm === ch.sourceQM && m.target_qm === ch.targetQM
      );
      if (!relevantMigration) return false;
      const activeStates: MigrationState[] = ['REWIRING', 'VALIDATING', 'MIGRATED'];
      return activeStates.includes(relevantMigration.state as MigrationState);
    }).map((ch) => {
      const migration = Object.values(migrations).find(
        (m) => m.source_qm === ch.sourceQM && m.target_qm === ch.targetQM
      );
      return { ...ch, isRewiring: migration?.state === 'REWIRING' || migration?.state === 'VALIDATING' };
    });
  },
};
