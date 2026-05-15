import { useState, useEffect, useCallback, useRef } from 'react';
import { IS_MOCK } from '../../../api/client';
import * as api from '../services';
import {
  MOCK_APPLICATIONS,
  MOCK_FLOWS,
  MOCK_LIVE_METRICS,
  MOCK_RUNTIME_LOGS,
  MOCK_VALIDATION_PHASES,
} from '../mock/data';
import type {
  WorkspaceApplication,
  WorkspaceFlow,
  LiveMetric,
  ValidationPhase,
  RuntimeLogEntry,
} from '../types';

// ── useApplications ────────────────────────────────────────────────────────────

export function useApplications() {
  const [applications, setApplications] = useState<WorkspaceApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (IS_MOCK) {
      setApplications(MOCK_APPLICATIONS);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const apps = await api.fetchApplications();
      setApplications(apps);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load applications');
      setApplications(MOCK_APPLICATIONS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { applications, loading, error, refetch: load };
}

// ── useFlows ───────────────────────────────────────────────────────────────────

export function useFlows(appId?: string | null) {
  const [flows, setFlows] = useState<WorkspaceFlow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (IS_MOCK) {
      setFlows(appId ? MOCK_FLOWS.filter(f => f.appId === appId) : MOCK_FLOWS);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await api.fetchFlows(appId ?? undefined);
      setFlows(data);
    } catch {
      setFlows(appId ? MOCK_FLOWS.filter(f => f.appId === appId) : MOCK_FLOWS);
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => { load(); }, [load]);

  return { flows, loading, refetch: load };
}

// ── useApplicationMetrics ─────────────────────────────────────────────────────

export function useApplicationMetrics(appId: string | null) {
  const [metrics, setMetrics] = useState<LiveMetric[]>(MOCK_LIVE_METRICS);

  useEffect(() => {
    if (!appId || IS_MOCK) {
      setMetrics(MOCK_LIVE_METRICS);
      return;
    }
    api.fetchApplicationMetrics(appId)
      .then(setMetrics)
      .catch(() => setMetrics(MOCK_LIVE_METRICS));

    // Refresh metrics every 15s
    const id = setInterval(() => {
      api.fetchApplicationMetrics(appId)
        .then(setMetrics)
        .catch(() => {});
    }, 15000);
    return () => clearInterval(id);
  }, [appId]);

  return metrics;
}

// ── useLogStream ───────────────────────────────────────────────────────────────

export function useLogStream(appId?: string | null, sessionId?: string | null) {
  const [logs, setLogs] = useState<RuntimeLogEntry[]>(MOCK_RUNTIME_LOGS.slice(-5));
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (IS_MOCK) return;

    const es = api.streamLogs(appId ?? undefined, sessionId ?? undefined);
    esRef.current = es;

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.level) {
          setLogs(prev => [...prev.slice(-49), {
            timestamp: data.timestamp * 1000,
            level: data.level as RuntimeLogEntry['level'],
            service: data.service,
            message: data.message,
          }]);
        }
      } catch {
        // ignore parse errors
      }
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [appId, sessionId]);

  return logs;
}

// ── useValidationPhases ────────────────────────────────────────────────────────

export function useValidationPhases(phase: 'source' | 'target') {
  const [phases, setPhases] = useState<ValidationPhase[]>(MOCK_VALIDATION_PHASES);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (IS_MOCK) {
      setPhases(MOCK_VALIDATION_PHASES);
      return;
    }
    setLoading(true);
    api.fetchValidationPhases(phase)
      .then(setPhases)
      .catch(() => setPhases(MOCK_VALIDATION_PHASES))
      .finally(() => setLoading(false));
  }, [phase]);

  return { phases, loading };
}

// ── useSourceValidation ────────────────────────────────────────────────────────

export function useSourceValidation() {
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [checks, setChecks] = useState<ValidationPhase[]>([]);
  const esRef = useRef<EventSource | null>(null);

  const run = useCallback((sourceQM: string, targetQM: string) => {
    if (isRunning) return;
    setIsRunning(true);
    setIsDone(false);

    if (IS_MOCK) {
      // simulate with timeouts
      let i = 0;
      const allChecks = MOCK_VALIDATION_PHASES.flatMap(p => p.checks);
      const tick = () => {
        if (i >= allChecks.length) {
          setIsRunning(false);
          setIsDone(true);
          return;
        }
        const check = allChecks[i++];
        setChecks(prev => {
          const flat = prev.flatMap(p => p.checks);
          const updated = flat.some(c => c.id === check.id)
            ? flat.map(c => c.id === check.id ? { ...check } : c)
            : [...flat, check];
          return MOCK_VALIDATION_PHASES.map(p => ({
            ...p,
            checks: p.checks.map(c => updated.find(u => u.id === c.id) ?? c),
          }));
        });
        setTimeout(tick, 400);
      };
      setChecks(MOCK_VALIDATION_PHASES);
      setTimeout(tick, 100);
      return;
    }

    const es = api.streamSourceValidation(sourceQM, targetQM);
    esRef.current = es;

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === 'check_update') {
          setChecks(prev => {
            const flat = prev.flatMap(p => p.checks);
            const idx = flat.findIndex(c => c.id === data.id);
            const newCheck = {
              id: data.id,
              label: data.label,
              status: data.status,
              detail: data.detail,
              latency: data.latency_ms,
            };
            const newFlat = idx >= 0
              ? flat.map((c, i) => i === idx ? newCheck : c)
              : [...flat, newCheck];
            // rebuild phases structure
            return MOCK_VALIDATION_PHASES.map(p => ({
              ...p,
              checks: p.checks.map(c => newFlat.find(n => n.id === c.id) ?? c),
            }));
          });
        } else if (data.type === 'complete' || data.type === 'done') {
          setIsRunning(false);
          setIsDone(true);
          es.close();
        }
      } catch {
        // ignore
      }
    };

    es.onerror = () => {
      setIsRunning(false);
      es.close();
    };
  }, [isRunning]);

  const reset = useCallback(() => {
    esRef.current?.close();
    setIsRunning(false);
    setIsDone(false);
    setChecks([]);
  }, []);

  return { checks, isRunning, isDone, run, reset };
}

// ── useTargetValidation ────────────────────────────────────────────────────────

export function useTargetValidation() {
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [checks, setChecks] = useState<{ id: string; label: string; status: string; detail?: string; latency?: number }[]>([]);
  const esRef = useRef<EventSource | null>(null);

  const run = useCallback((targetQM: string) => {
    if (isRunning) return;
    setIsRunning(true);
    setIsDone(false);

    if (IS_MOCK) {
      const allChecks = MOCK_VALIDATION_PHASES.flatMap(p => p.checks);
      let i = 0;
      const tick = () => {
        if (i >= allChecks.length) {
          setIsRunning(false);
          setIsDone(true);
          return;
        }
        const c = allChecks[i++];
        setChecks(prev => {
          const idx = prev.findIndex(x => x.id === c.id);
          return idx >= 0
            ? prev.map((x, j) => j === idx ? { ...c } : x)
            : [...prev, { ...c }];
        });
        setTimeout(tick, 380);
      };
      setTimeout(tick, 100);
      return;
    }

    const es = api.streamTargetValidation(targetQM);
    esRef.current = es;

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === 'check_update') {
          setChecks(prev => {
            const idx = prev.findIndex(c => c.id === data.id);
            const nc = { id: data.id, label: data.label, status: data.status, detail: data.detail, latency: data.latency_ms };
            return idx >= 0 ? prev.map((c, i) => i === idx ? nc : c) : [...prev, nc];
          });
        } else if (data.type === 'complete' || data.type === 'done') {
          setIsRunning(false);
          setIsDone(true);
          es.close();
        }
      } catch { /* ignore */ }
    };

    es.onerror = () => {
      setIsRunning(false);
      es.close();
    };
  }, [isRunning]);

  const reset = useCallback(() => {
    esRef.current?.close();
    setIsRunning(false);
    setIsDone(false);
    setChecks([]);
  }, []);

  return { checks, isRunning, isDone, run, reset };
}

// ── useDeployment ──────────────────────────────────────────────────────────────

export function useDeployment() {
  const [isDeploying, setIsDeploying] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [lines, setLines] = useState<Array<{ id: number; ts: string; level: string; text: string }>>([]);
  const counterRef = useRef(0);
  const esRef = useRef<EventSource | null>(null);

  const deploy = useCallback((config: api.RedeployConfig) => {
    if (isDeploying) return;
    setIsDeploying(true);
    setIsDone(false);
    setLines([]);

    if (IS_MOCK) {
      // Defer to ConfigRedeploy's local simulation — just mark done after delay
      setTimeout(() => {
        setIsDeploying(false);
        setIsDone(true);
      }, 5000);
      return;
    }

    const es = api.streamRedeploy(config);
    esRef.current = es;

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.level) {
          setLines(prev => [...prev, {
            id: counterRef.current++,
            ts: new Date(data.timestamp * 1000).toISOString().replace('T', ' ').slice(0, 23),
            level: data.level,
            text: data.text,
          }]);
        } else if (data.type === 'done') {
          setIsDeploying(false);
          setIsDone(true);
          es.close();
        }
      } catch { /* ignore */ }
    };

    es.onerror = () => {
      setIsDeploying(false);
      es.close();
    };
  }, [isDeploying]);

  const reset = useCallback(() => {
    esRef.current?.close();
    setIsDeploying(false);
    setIsDone(false);
    setLines([]);
  }, []);

  return { lines, isDeploying, isDone, deploy, reset };
}

// ── useTrafficShift ────────────────────────────────────────────────────────────

export function useTrafficShift() {
  const [shifting, setShifting] = useState(false);

  const shift = useCallback(async (flowId: string, trafficSplit: number, sessionId?: string) => {
    if (IS_MOCK) return { traffic_split: trafficSplit };
    setShifting(true);
    try {
      const result = await api.shiftTraffic(flowId, trafficSplit, sessionId);
      return result;
    } finally {
      setShifting(false);
    }
  }, []);

  const doRollback = useCallback(async (flowId: string, reason?: string, sessionId?: string) => {
    if (IS_MOCK) return { status: 'rolled_back' };
    try {
      return await api.rollback(flowId, reason, sessionId);
    } catch {
      return { status: 'rolled_back' };
    }
  }, []);

  return { shift, doRollback, shifting };
}
