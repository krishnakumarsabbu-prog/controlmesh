import { bclClient } from '../../../api/client';
import type {
  WorkspaceApplication,
  WorkspaceFlow,
  ValidationPhase,
  ValidationCheckResult,
  RuntimeLogEntry,
  LiveMetric,
} from '../types';

const BASE = '/api/migration-workspace';

// ── Application API ────────────────────────────────────────────────────────────

export async function fetchApplications(): Promise<WorkspaceApplication[]> {
  const res = await bclClient.get(`${BASE}/applications`);
  return res.data.applications;
}

export async function fetchApplication(appId: string): Promise<WorkspaceApplication> {
  const res = await bclClient.get(`${BASE}/applications/${appId}`);
  return res.data;
}

export async function fetchApplicationMetrics(appId: string): Promise<LiveMetric[]> {
  const res = await bclClient.get(`${BASE}/applications/${appId}/metrics`);
  const m = res.data;
  return [
    { label: 'Active Path',  value: m.active_path,          color: 'cyan',  trend: 'stable' },
    { label: 'Traffic',      value: m.traffic_msg_per_min,  unit: 'msg/min', color: 'cyan', trend: 'up', trendValue: '+8.21%' },
    { label: 'Success Rate', value: m.success_rate,         unit: '%',       color: 'green', trend: 'stable' },
    { label: 'Avg Latency',  value: m.avg_latency_ms,       unit: 'ms',      color: 'cyan', trend: 'down', trendValue: '-3.2%' },
    { label: 'Error Rate',   value: m.error_rate,           unit: '%',       color: 'green', trend: 'down', trendValue: '-12.5%' },
    { label: 'Consumers Up', value: m.consumers_up,         color: 'green', trend: 'stable' },
  ];
}

// ── Flow API ───────────────────────────────────────────────────────────────────

export async function fetchFlows(appId?: string): Promise<WorkspaceFlow[]> {
  const params = appId ? { app_id: appId } : {};
  const res = await bclClient.get(`${BASE}/flows`, { params });
  return res.data.flows.map(normalizeFlow);
}

export async function fetchFlow(flowId: string): Promise<WorkspaceFlow> {
  const res = await bclClient.get(`${BASE}/flows/${flowId}`);
  return normalizeFlow(res.data);
}

function normalizeFlow(f: Record<string, unknown>): WorkspaceFlow {
  return {
    id: f.id as string,
    name: f.name as string,
    appId: (f.app_id ?? f.appId) as string,
    sourceQM: (f.source_qm ?? f.sourceQM) as string,
    targetQM: (f.target_qm ?? f.targetQM) as string,
    activePath: ((f.active_path ?? f.activePath) as string) as WorkspaceFlow['activePath'],
    trafficSplit: (f.traffic_split ?? f.trafficSplit ?? 0) as number,
    status: f.status as WorkspaceFlow['status'],
  };
}

// ── Session API ────────────────────────────────────────────────────────────────

export async function createSession(appId: string, flowId: string): Promise<{ id: string }> {
  const res = await bclClient.post(`${BASE}/sessions`, { app_id: appId, flow_id: flowId });
  return res.data;
}

export async function fetchSession(sessionId: string) {
  const res = await bclClient.get(`${BASE}/sessions/${sessionId}`);
  return res.data;
}

// ── Validation API ─────────────────────────────────────────────────────────────

export interface ValidateSourceResult {
  status: string;
  source_qm: string;
  target_qm: string;
  checks: Array<{
    id: string;
    label: string;
    status: ValidationCheckResult['status'];
    detail?: string;
    latency_ms?: number;
  }>;
}

export async function validateSource(sourceQM: string, targetQM: string, appId?: string, sessionId?: string): Promise<ValidateSourceResult> {
  const res = await bclClient.post(`${BASE}/validate-source`, {
    source_qm: sourceQM,
    target_qm: targetQM,
    app_id: appId,
    session_id: sessionId,
  });
  return res.data;
}

export async function validateTarget(targetQM: string, appId?: string, sessionId?: string): Promise<ValidateSourceResult> {
  const res = await bclClient.post(`${BASE}/validate-target`, {
    target_qm: targetQM,
    app_id: appId,
    session_id: sessionId,
  });
  return res.data;
}

export function streamSourceValidation(sourceQM: string, targetQM: string): EventSource {
  const url = `${BASE}/validate-source/stream?source_qm=${encodeURIComponent(sourceQM)}&target_qm=${encodeURIComponent(targetQM)}`;
  return new EventSource(url);
}

export function streamTargetValidation(targetQM: string): EventSource {
  const url = `${BASE}/validate-target/stream?target_qm=${encodeURIComponent(targetQM)}`;
  return new EventSource(url);
}

// ── Deployment API ─────────────────────────────────────────────────────────────

export interface RedeployConfig {
  strategy: string;
  queueManager: string;
  channel: string;
  host: string;
  port: string;
  queueName: string;
  tls: boolean;
  retryPolicy: string;
  appId?: string;
  sessionId?: string;
}

export async function redeploy(config: RedeployConfig) {
  const res = await bclClient.post(`${BASE}/redeploy`, {
    strategy: config.strategy,
    queue_manager: config.queueManager,
    channel: config.channel,
    host: config.host,
    port: config.port,
    queue_name: config.queueName,
    tls: config.tls,
    retry_policy: config.retryPolicy,
    app_id: config.appId,
    session_id: config.sessionId,
  });
  return res.data;
}

export function streamRedeploy(config: RedeployConfig): EventSource {
  const params = new URLSearchParams({
    strategy: config.strategy,
    queue_manager: config.queueManager,
    channel: config.channel,
    host: config.host,
    port: config.port,
    queue_name: config.queueName,
    tls: String(config.tls),
    retry_policy: config.retryPolicy,
  });
  return new EventSource(`${BASE}/redeploy/stream?${params}`);
}

// ── Traffic shift API ──────────────────────────────────────────────────────────

export async function shiftTraffic(flowId: string, trafficSplit: number, sessionId?: string) {
  const res = await bclClient.post(`${BASE}/traffic-shift`, {
    flow_id: flowId,
    traffic_split: trafficSplit,
    session_id: sessionId,
  });
  return res.data;
}

// ── Rollback API ───────────────────────────────────────────────────────────────

export async function rollback(flowId: string, reason?: string, sessionId?: string) {
  const res = await bclClient.post(`${BASE}/rollback`, {
    flow_id: flowId,
    reason,
    session_id: sessionId,
  });
  return res.data;
}

// ── Log stream ─────────────────────────────────────────────────────────────────

export function streamLogs(appId?: string, sessionId?: string): EventSource {
  const params = new URLSearchParams();
  if (appId) params.set('app_id', appId);
  if (sessionId) params.set('session_id', sessionId);
  const qs = params.toString();
  return new EventSource(`${BASE}/logs/stream${qs ? `?${qs}` : ''}`);
}

// ── Migration plan API ─────────────────────────────────────────────────────────

export async function createMigrationPlan(appId: string, sourceQM: string, targetQM: string, strategy = 'blue-green') {
  const res = await bclClient.post(`${BASE}/plan`, null, {
    params: { app_id: appId, source_qm: sourceQM, target_qm: targetQM, strategy },
  });
  return res.data;
}

// ── Summary API ────────────────────────────────────────────────────────────────

export async function fetchMigrationSummary(sessionId: string) {
  const res = await bclClient.get(`${BASE}/summary/${sessionId}`);
  return res.data;
}

// ── Validation phases (check definitions) ─────────────────────────────────────

export async function fetchValidationPhases(phase: 'source' | 'target'): Promise<ValidationPhase[]> {
  const res = await bclClient.get(`${BASE}/validation-phases`, { params: { phase } });
  return res.data.phases.map((p: Record<string, unknown>) => ({
    id: p.id,
    label: p.label,
    checks: (p.checks as Array<Record<string, unknown>>).map(c => ({
      id: c.id,
      label: c.label,
      status: c.status ?? 'pending',
      detail: c.detail ?? undefined,
      latency: c.latency_ms ?? undefined,
    })),
  }));
}
