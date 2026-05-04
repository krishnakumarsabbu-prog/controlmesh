import { useState, useRef, useCallback } from 'react';
import { executeMigration, planMigration, rollbackMigration } from '../api/migration';
import { mockApi } from '../api/mock/service';
import type { AssistantMessage } from '../components/shared/FloatingAssistant';

const APPS = [
  { id: 'APP1', source: 'QM.SRC.A', target: 'QM.APP1' },
  { id: 'APP2', source: 'QM.SRC.A', target: 'QM.APP2' },
  { id: 'APP3', source: 'QM.SRC.A', target: 'QM.APP3' },
  { id: 'APP4', source: 'QM.SRC.B', target: 'QM.APP4' },
  { id: 'APP5', source: 'QM.SRC.B', target: 'QM.APP5' },
  { id: 'APP6', source: 'QM.SRC.B', target: 'QM.APP6' },
];

let msgCounter = 0;
function makeMsg(text: string, type: AssistantMessage['type'] = 'info'): AssistantMessage {
  return { id: `msg-${++msgCounter}-${Date.now()}`, text, type };
}

function waitForState(
  appId: string,
  targetStates: string[],
  timeoutMs = 30000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const unsubscribe = mockApi.subscribeSSE((record) => {
      if (record.app_id !== appId) return;
      if (targetStates.includes(record.state)) {
        unsubscribe();
        resolve(record.state);
      }
      if (record.state === 'ROLLING_BACK' || record.state === 'ROLLED_BACK') {
        if (!targetStates.includes(record.state)) {
          unsubscribe();
          reject(new Error(`${appId} entered ${record.state}: ${record.error ?? 'unknown error'}`));
        }
      }
      if (Date.now() > deadline) {
        unsubscribe();
        reject(new Error(`Timeout waiting for ${appId} to reach ${targetStates.join('/')}`));
      }
    });
    // Poll deadline
    const timer = setInterval(() => {
      if (Date.now() > deadline) {
        clearInterval(timer);
        unsubscribe();
        reject(new Error(`Timeout waiting for ${appId}`));
      }
    }, 500);
  });
}

export function useAutonomousMigration(
  onMessage: (msg: AssistantMessage) => void,
) {
  const [running, setRunning] = useState(false);
  const [currentApp, setCurrentApp] = useState<string | null>(null);
  const abortRef = useRef(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    setElapsedSeconds(0);
    const start = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);
  }, [stopTimer]);

  const run = useCallback(async (getMigrations: () => Record<string, { state: string }>) => {
    if (running) return;
    setRunning(true);
    abortRef.current = false;
    startTimer();

    onMessage(makeMsg('Autonomous migration sequence started. Analysing current topology…', 'info'));
    await new Promise((r) => setTimeout(r, 600));

    for (const app of APPS) {
      if (abortRef.current) break;

      const current = getMigrations()[app.id];
      if (current?.state === 'MIGRATED') {
        onMessage(makeMsg(`${app.id} already migrated — skipping.`, 'success'));
        continue;
      }

      setCurrentApp(app.id);

      // Plan step
      onMessage(makeMsg(`Planning migration for ${app.id} (${app.source} → ${app.target})…`, 'info'));
      try {
        const plan = await planMigration(app.id, app.source, app.target);
        onMessage(makeMsg(`Plan ready: ${plan.total_steps} steps. Executing…`, 'info'));
      } catch {
        onMessage(makeMsg(`Failed to plan ${app.id} — skipping.`, 'error'));
        continue;
      }

      if (abortRef.current) break;

      // Execute
      onMessage(makeMsg(`Executing step 1/${7}: Baseline validation for ${app.id}…`, 'info'));
      try {
        await executeMigration(app.id, app.source, app.target);
      } catch {
        onMessage(makeMsg(`Failed to start migration for ${app.id}.`, 'error'));
        continue;
      }

      // Watch progress narration
      const stateMessages: Partial<Record<string, string>> = {
        SNAPSHOTTED:          `${app.id} — topology snapshotted. Provisioning target QM…`,
        PROVISIONING_TARGET:  `${app.id} — provisioning ${app.target} with queues, channels, listener…`,
        REWIRING:             `${app.id} — rewiring traffic transparently via remote queue definitions…`,
        VALIDATING:           `${app.id} — validating: message flow, latency, channel health…`,
      };

      const unsubscribe = mockApi.subscribeSSE((record) => {
        if (record.app_id !== app.id) return;
        const msg = stateMessages[record.state];
        if (msg) onMessage(makeMsg(msg, 'info'));
      });

      // Wait for terminal state
      try {
        const finalState = await waitForState(app.id, ['MIGRATED', 'ROLLED_BACK'], 60000);
        unsubscribe();
        if (finalState === 'MIGRATED') {
          onMessage(makeMsg(`${app.id} successfully migrated to ${app.target}.`, 'success'));
        } else {
          onMessage(makeMsg(`${app.id} rolled back to ${app.source} — topology restored.`, 'warning'));
        }
      } catch (err) {
        unsubscribe();
        const msg = err instanceof Error ? err.message : String(err);
        onMessage(makeMsg(`${app.id} error: ${msg}. Attempting rollback…`, 'error'));
        try {
          await rollbackMigration(app.id);
          await waitForState(app.id, ['ROLLED_BACK'], 30000);
          onMessage(makeMsg(`${app.id} rollback complete.`, 'warning'));
        } catch {
          onMessage(makeMsg(`${app.id} rollback also failed. Manual intervention required.`, 'error'));
        }
      }

      // Small gap between apps
      if (!abortRef.current) await new Promise((r) => setTimeout(r, 800));
    }

    stopTimer();
    setCurrentApp(null);
    setRunning(false);

    if (!abortRef.current) {
      onMessage(makeMsg('Autonomous migration sequence complete. All apps processed.', 'success'));
    }
  }, [running, startTimer, stopTimer, onMessage]);

  const abort = useCallback(() => {
    abortRef.current = true;
    stopTimer();
    setRunning(false);
    setCurrentApp(null);
  }, [stopTimer]);

  return { running, currentApp, elapsedSeconds, run, abort };
}
