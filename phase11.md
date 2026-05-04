# Phase 11: React UI Control Plane Implementation

**Duration:** 3–4 days
**Objective:** Build the complete React + TypeScript UI control plane with four primary views: topology graph, migration console, validation panel, and rollback/audit log — all backed exclusively by the BCL REST API.

---

## Context and Rationale

The UI is the operational face of the entire system. Judges, stakeholders, and operators must be able to see the topology, trigger migrations, watch progress in real time, and understand validation results and rollback events at a glance — without needing to read logs.

The UI has zero direct MQ knowledge. Every action goes through the BCL. The BCL is the system of record.

---

## Technology Stack

| Concern | Choice |
|---------|--------|
| Framework | React 18 + TypeScript + Vite |
| UI components | Shadcn/ui + Tailwind CSS |
| Graph visualization | React Flow |
| Data fetching | TanStack Query (React Query) |
| Real-time updates | EventSource (SSE) from BCL |
| State management | Zustand |
| Charts | Recharts |
| HTTP client | Axios |

---

## Application Structure

```
ui/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── api/
│   │   ├── client.ts          # Axios instance + interceptors
│   │   ├── fleet.ts           # /api/fleet queries
│   │   ├── migration.ts       # /api/migration queries + mutations
│   │   ├── validation.ts      # /api/validate queries
│   │   └── audit.ts           # /api/audit queries
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── StatusBar.tsx
│   │   ├── topology/
│   │   │   ├── TopologyCanvas.tsx   # React Flow wrapper
│   │   │   ├── QMNode.tsx           # Queue manager node
│   │   │   ├── QueueNode.tsx        # Queue node
│   │   │   ├── ChannelEdge.tsx      # Channel edge
│   │   │   └── TopologyLegend.tsx
│   │   ├── migration/
│   │   │   ├── MigrationConsole.tsx # Vertical stepper
│   │   │   ├── AppMigrationRow.tsx  # Per-app status row
│   │   │   └── MigrationControls.tsx
│   │   ├── validation/
│   │   │   ├── ValidationPanel.tsx  # Phase × App matrix
│   │   │   ├── ValidationBadge.tsx  # Green/red badge
│   │   │   └── ValidationDetail.tsx
│   │   └── audit/
│   │       ├── AuditLog.tsx
│   │       ├── AuditEntry.tsx
│   │       └── RollbackStatus.tsx
│   ├── hooks/
│   │   ├── useMigrationStream.ts    # SSE hook
│   │   ├── useFleet.ts
│   │   └── useMigrations.ts
│   ├── store/
│   │   └── migrationStore.ts        # Zustand store
│   ├── types/
│   │   └── index.ts
│   └── pages/
│       ├── TopologyPage.tsx
│       ├── MigrationPage.tsx
│       ├── ValidationPage.tsx
│       └── AuditPage.tsx
├── index.html
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

---

## Core Implementations

### 11.1 API Client

```typescript
// src/api/client.ts
import axios from 'axios';

const BCL_URL = import.meta.env.VITE_BCL_URL || 'http://bcl-gateway-svc:8000';

export const bclClient = axios.create({
  baseURL: BCL_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

bclClient.interceptors.response.use(
  (r) => r,
  (err) => {
    console.error('BCL error:', err.response?.data ?? err.message);
    return Promise.reject(err);
  }
);
```

---

### 11.2 Types

```typescript
// src/types/index.ts
export type MigrationState =
  | 'IDLE'
  | 'SNAPSHOTTED'
  | 'PROVISIONING_TARGET'
  | 'REWIRING'
  | 'VALIDATING'
  | 'MIGRATED'
  | 'ROLLING_BACK'
  | 'ROLLED_BACK';

export interface QueueManager {
  name: string;
  internal_name: string;
  svc_url: string;
  role: 'source' | 'target';
}

export interface MigrationRecord {
  app_id: string;
  state: MigrationState;
  source_qm: string;
  target_qm: string;
  started_at: string | null;
  updated_at: string | null;
  error: string | null;
  validation_results: ValidationResult[];
}

export interface ValidationResult {
  phase: 'BASELINE' | 'POST_REWIRE' | 'FINAL';
  passed: boolean;
  latency_ms: number;
  details?: string;
}

export interface AuditEvent {
  timestamp: number;
  operation: string;
  qm_target: string;
  agent: string;
  result: string;
  trace_id: string;
}
```

---

### 11.3 SSE Hook

```typescript
// src/hooks/useMigrationStream.ts
import { useEffect } from 'react';
import { useMigrationStore } from '../store/migrationStore';

const BCL_URL = import.meta.env.VITE_BCL_URL || 'http://bcl-gateway-svc:8000';

export function useMigrationStream() {
  const { updateMigrationState } = useMigrationStore();

  useEffect(() => {
    const es = new EventSource(`${BCL_URL}/api/migration/stream`);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'state_change') {
          updateMigrationState(data.app_id, data.state);
        }
      } catch {
        // ignore malformed events
      }
    };

    es.onerror = () => {
      // Reconnect handled automatically by EventSource
    };

    return () => es.close();
  }, [updateMigrationState]);
}
```

---

### 11.4 Zustand Store

```typescript
// src/store/migrationStore.ts
import { create } from 'zustand';
import { MigrationRecord, MigrationState } from '../types';

interface MigrationStore {
  migrations: Record<string, MigrationRecord>;
  setMigrations: (records: MigrationRecord[]) => void;
  updateMigrationState: (appId: string, state: MigrationState) => void;
}

export const useMigrationStore = create<MigrationStore>((set) => ({
  migrations: {},

  setMigrations: (records) =>
    set({
      migrations: Object.fromEntries(records.map((r) => [r.app_id, r])),
    }),

  updateMigrationState: (appId, state) =>
    set((s) => ({
      migrations: {
        ...s.migrations,
        [appId]: { ...s.migrations[appId], state },
      },
    })),
}));
```

---

### 11.5 Topology Graph

```typescript
// src/components/topology/TopologyCanvas.tsx
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { QueueManager, MigrationRecord } from '../../types';
import QMNode from './QMNode';
import ChannelEdge from './ChannelEdge';

interface Props {
  queueManagers: QueueManager[];
  migrations: MigrationRecord[];
  mode: 'source' | 'target';
}

const nodeTypes = { qmNode: QMNode };
const edgeTypes = { channelEdge: ChannelEdge };

const STATE_COLORS: Record<string, string> = {
  IDLE: '#6b7280',
  SNAPSHOTTED: '#3b82f6',
  PROVISIONING_TARGET: '#f59e0b',
  REWIRING: '#f59e0b',
  VALIDATING: '#8b5cf6',
  MIGRATED: '#10b981',
  ROLLING_BACK: '#ef4444',
  ROLLED_BACK: '#6b7280',
};

export default function TopologyCanvas({ queueManagers, migrations, mode }: Props) {
  const nodes: Node[] = queueManagers
    .filter((qm) => mode === 'source' ? qm.role === 'source' : true)
    .map((qm, i) => {
      const migration = migrations.find((m) =>
        mode === 'source' ? m.source_qm === qm.name : m.target_qm === qm.name
      );
      return {
        id: qm.name,
        type: 'qmNode',
        position: { x: (i % 3) * 280, y: Math.floor(i / 3) * 200 },
        data: {
          label: qm.name,
          role: qm.role,
          migrationState: migration?.state ?? 'IDLE',
          stateColor: STATE_COLORS[migration?.state ?? 'IDLE'],
        },
      };
    });

  const edges: Edge[] = migrations
    .filter((m) => m.state === 'REWIRING' || m.state === 'VALIDATING')
    .map((m) => ({
      id: `${m.source_qm}-${m.target_qm}`,
      source: m.source_qm,
      target: m.target_qm,
      type: 'channelEdge',
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { label: `CHL.SRCA.${m.app_id}`, state: m.state },
    }));

  return (
    <div className="h-96 w-full rounded-lg border border-gray-200 bg-gray-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
```

---

### 11.6 Migration Console

```typescript
// src/components/migration/MigrationConsole.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bclClient } from '../../api/client';
import { useMigrationStore } from '../../store/migrationStore';
import { useMigrationStream } from '../../hooks/useMigrationStream';
import AppMigrationRow from './AppMigrationRow';

const APPS = ['APP1', 'APP2', 'APP3', 'APP4', 'APP5', 'APP6'];

const APP_QM_MAP: Record<string, { source: string; target: string }> = {
  APP1: { source: 'QM.SRC.A', target: 'QM.APP1' },
  APP2: { source: 'QM.SRC.A', target: 'QM.APP2' },
  APP3: { source: 'QM.SRC.A', target: 'QM.APP3' },
  APP4: { source: 'QM.SRC.B', target: 'QM.APP4' },
  APP5: { source: 'QM.SRC.B', target: 'QM.APP5' },
  APP6: { source: 'QM.SRC.B', target: 'QM.APP6' },
};

export default function MigrationConsole() {
  useMigrationStream();
  const qc = useQueryClient();
  const { migrations, setMigrations } = useMigrationStore();

  useQuery({
    queryKey: ['migrations'],
    queryFn: async () => {
      const { data } = await bclClient.get('/api/migration/status');
      setMigrations(data.migrations);
      return data.migrations;
    },
    refetchInterval: 5000,
  });

  const triggerMigration = useMutation({
    mutationFn: (appId: string) =>
      bclClient.post('/api/migration/execute', {
        app_id: appId,
        source_qm: APP_QM_MAP[appId].source,
        target_qm: APP_QM_MAP[appId].target,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['migrations'] }),
  });

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900">Migration Console</h2>
      <div className="rounded-lg border border-gray-200 bg-white">
        {APPS.map((appId) => (
          <AppMigrationRow
            key={appId}
            appId={appId}
            record={migrations[appId]}
            onMigrate={() => triggerMigration.mutate(appId)}
            sourceQm={APP_QM_MAP[appId].source}
            targetQm={APP_QM_MAP[appId].target}
          />
        ))}
      </div>
    </div>
  );
}
```

---

### 11.7 Validation Panel

```typescript
// src/components/validation/ValidationPanel.tsx
import { useQuery } from '@tanstack/react-query';
import { bclClient } from '../../api/client';
import ValidationBadge from './ValidationBadge';

const APPS = ['APP1', 'APP2', 'APP3', 'APP4', 'APP5', 'APP6'];
const PHASES = ['BASELINE', 'POST_REWIRE', 'FINAL'] as const;

export default function ValidationPanel() {
  const { data } = useQuery({
    queryKey: ['validation-history'],
    queryFn: async () => {
      const results = await Promise.all(
        APPS.map((app) =>
          bclClient
            .get(`/api/validate/${app}/history`)
            .then((r) => ({ app, results: r.data.results }))
            .catch(() => ({ app, results: [] }))
        )
      );
      return Object.fromEntries(results.map((r) => [r.app, r.results]));
    },
    refetchInterval: 10000,
  });

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Validation Matrix
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-600">App</th>
              {PHASES.map((p) => (
                <th key={p} className="px-4 py-3 text-center font-medium text-gray-600">
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {APPS.map((app) => (
              <tr key={app} className="border-t border-gray-100">
                <td className="px-4 py-3 font-medium text-gray-800">{app}</td>
                {PHASES.map((phase) => {
                  const result = data?.[app]?.find((r: any) => r.phase === phase);
                  return (
                    <td key={phase} className="px-4 py-3 text-center">
                      <ValidationBadge result={result} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

### 11.8 Audit Log

```typescript
// src/components/audit/AuditLog.tsx
import { useQuery } from '@tanstack/react-query';
import { bclClient } from '../../api/client';
import { AuditEvent } from '../../types';
import { formatDistanceToNow } from 'date-fns';

export default function AuditLog() {
  const { data } = useQuery({
    queryKey: ['audit'],
    queryFn: async () => {
      const { data } = await bclClient.get('/api/audit?limit=50');
      return data.events as AuditEvent[];
    },
    refetchInterval: 5000,
  });

  const resultColor = (result: string) =>
    result === 'SUCCESS' || result === 'PASS'
      ? 'text-emerald-600'
      : result === 'FAIL' || result === 'ERROR'
      ? 'text-red-600'
      : 'text-amber-600';

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold text-gray-900">Audit Log</h2>
      <div className="rounded-lg border border-gray-200 bg-white max-h-96 overflow-y-auto">
        {(data ?? []).map((event, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-2 border-b border-gray-50 text-sm"
          >
            <span className="text-gray-400 tabular-nums w-28 shrink-0">
              {formatDistanceToNow(new Date(event.timestamp * 1000), { addSuffix: true })}
            </span>
            <span className="font-mono text-gray-600 w-40 shrink-0">
              {event.operation}
            </span>
            <span className="text-gray-500 w-28 shrink-0">{event.qm_target}</span>
            <span className="text-gray-400 w-28 shrink-0">{event.agent}</span>
            <span className={`font-medium ${resultColor(event.result)}`}>
              {event.result}
            </span>
          </div>
        ))}
        {!data?.length && (
          <p className="px-4 py-8 text-center text-gray-400">
            No audit events yet
          </p>
        )}
      </div>
    </div>
  );
}
```

---

## OCP Deployment

```yaml
# ocp/ui/ui-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mq-ui
  namespace: mq-hackathon
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mq-ui
  template:
    metadata:
      labels:
        app: mq-ui
    spec:
      containers:
      - name: ui
        image: mq-ui:latest
        ports:
        - containerPort: 3000
        env:
        - name: VITE_BCL_URL
          value: "http://bcl-gateway-svc:8000"
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
---
apiVersion: v1
kind: Service
metadata:
  name: mq-ui-svc
  namespace: mq-hackathon
spec:
  selector:
    app: mq-ui
  ports:
  - port: 3000
---
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: mq-ui-route
  namespace: mq-hackathon
spec:
  to:
    kind: Service
    name: mq-ui-svc
  port:
    targetPort: 3000
  tls:
    termination: edge
```

---

## Success Criteria

| Criterion | Verification |
|-----------|-------------|
| Topology graph renders source + target canvases | Browse to UI route |
| Migration console shows all 6 apps | All rows visible with correct state |
| Real-time state updates via SSE | Trigger migration — row updates within 2s |
| Validation matrix shows pass/fail badges | After migration, all 3 phases show green |
| Audit log shows time-ordered events | Scroll through log after full migration |
| Migration can be triggered from UI | Click "Migrate" — BCL POST executes |
| Responsive on mobile | Test at 375px viewport width |
| Zero direct MQ knowledge in UI code | No MQ REST calls in `src/` outside `api/` |
