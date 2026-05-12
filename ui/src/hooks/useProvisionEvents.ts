import { useState, useEffect, useCallback, useRef } from 'react';
import { openProvisionEventStream, type ProvisionEvent, type TopologyNodeData } from '../api/topologyUpload';

export type { ProvisionEvent };

export interface ProvisionedNode extends TopologyNodeData {
  status: 'pending' | 'provisioning' | 'success' | 'failed';
  provisioned_at?: number;
  mq_response?: Record<string, unknown>;
  logs: string[];
  step?: string;
  parent_qm?: string;
  queue_type?: string;
}

export interface ProvisionState {
  nodes: Record<string, ProvisionedNode>;
  edges: Array<{ source: string; target: string; id: string }>;
  isRunning: boolean;
  isComplete: boolean;
  events: ProvisionEvent[];
  error: string | null;
}

const INITIAL_STATE: ProvisionState = {
  nodes: {},
  edges: [],
  isRunning: false,
  isComplete: false,
  events: [],
  error: null,
};

export function useProvisionEvents(sessionId: string | null) {
  const [state, setState] = useState<ProvisionState>(INITIAL_STATE);
  const esRef = useRef<EventSource | null>(null);

  const reset = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    esRef.current?.close();
    setState({ ...INITIAL_STATE, isRunning: true });

    const es = openProvisionEventStream(sessionId);
    esRef.current = es;

    es.onmessage = (evt) => {
      try {
        const event: ProvisionEvent = JSON.parse(evt.data);

        setState((prev) => {
          const newEvents = [...prev.events, event];
          const newNodes = { ...prev.nodes };

          if (event.type === 'node_provisioning' && event.node_id) {
            newNodes[event.node_id] = {
              id: event.node_id,
              type: (event.node_type as TopologyNodeData['type']) || 'qmNode',
              label: event.label || event.node_id,
              status: 'provisioning',
              step: event.step,
              queue_type: event.queue_type,
              parent_qm: event.parent_qm,
              source_qm: event.source_qm,
              target_qm: event.target_qm,
              logs: [`[${new Date().toISOString()}] Provisioning started`],
            } as ProvisionedNode;
          } else if (event.type === 'node_provisioned' && event.node_id) {
            const existing = newNodes[event.node_id] || {
              id: event.node_id,
              type: (event.node_type as TopologyNodeData['type']) || 'qmNode',
              label: event.label || event.node_id,
              logs: [],
            };
            newNodes[event.node_id] = {
              ...existing,
              status: event.status === 'success' ? 'success' : 'failed',
              mq_response: event.mq_response,
              provisioned_at: event.ts,
              logs: [
                ...(existing.logs || []),
                `[${new Date().toISOString()}] ${event.status === 'success' ? 'Provisioned successfully' : 'Provisioning failed'}`,
              ],
            };
          }

          const isComplete = event.type === 'complete';
          const isError = event.type === 'error';

          return {
            ...prev,
            nodes: newNodes,
            events: newEvents,
            isRunning: !isComplete && !isError,
            isComplete,
            error: isError ? event.message || 'Provisioning failed' : prev.error,
          };
        });
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      setState((prev) => ({
        ...prev,
        isRunning: false,
        error: prev.isComplete ? null : 'Connection lost',
      }));
    };

    return () => {
      es.close();
    };
  }, [sessionId]);

  return { ...state, reset };
}
