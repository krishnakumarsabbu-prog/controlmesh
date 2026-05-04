# Phase 11: React UI Control Plane — Full Implementation

**Duration:** 3–4 days
**Objective:** Build a production-quality React + TypeScript UI control plane that makes judges stop and stare. Four primary dashboards — Topology Graph, Migration Console, Validation Panel, Rollback & Audit — all backed exclusively by the BCL REST API with zero direct MQ knowledge in the UI.

---

## Design Philosophy

The UI must communicate operational state at a glance. Judges should understand the entire migration story — source topology, migration progress, validation results, rollback events — within 10 seconds of looking at the screen. The visual design draws from infrastructure control planes like Argo CD, Grafana, and AWS Console:

- **Dark sidebar** with icon navigation
- **Color-coded state system** — green = healthy/migrated, amber = in-progress, red = failed/rolling-back, grey = idle
- **Animated topology graph** — nodes pulse when migrating, edges animate when channels carry traffic
- **Live updates** via SSE — no page refresh needed
- **Dense information layout** — operators can see everything without scrolling

---

## Technology Stack

| Concern | Choice | Reason |
|---------|--------|--------|
| Framework | React 18 + TypeScript + Vite | Fast build, strong typing |
| UI components | shadcn/ui + Tailwind CSS | Flexible, not opinionated |
| Graph visualization | React Flow 11 | Best-in-class topology rendering |
| Data fetching | TanStack Query v5 | Auto-refresh, cache invalidation |
| Real-time | EventSource (SSE) + Zustand | Live state without WebSocket complexity |
| Charts | Recharts | Latency sparklines, depth gauges |
| Icons | Lucide React | Consistent, sharp icons |
| Animations | Framer Motion | Node transitions, state badge pulses |
| Date formatting | date-fns | Relative timestamps in audit log |
| HTTP | Axios | Interceptors + error normalization |

---

## Application Structure

```
ui/
├── src/
│   ├── main.tsx
│   ├── App.tsx                        # Router + layout shell
│   ├── api/
│   │   ├── client.ts                  # Axios base instance
│   │   ├── fleet.ts                   # Fleet queries
│   │   ├── migration.ts               # Migration queries + mutations
│   │   ├── validation.ts              # Validation history queries
│   │   └── audit.ts                   # Audit log queries
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx           # Sidebar + content area
│   │   │   ├── Sidebar.tsx            # Icon nav with active state
│   │   │   ├── TopBar.tsx             # System health + clock
│   │   │   └── StatusBar.tsx          # Fleet health summary
│   │   ├── topology/
│   │   │   ├── TopologyPage.tsx       # Side-by-side source + target
│   │   │   ├── TopologyCanvas.tsx     # React Flow wrapper
│   │   │   ├── QMNode.tsx             # Queue manager node with badge
│   │   │   ├── AppQueueNode.tsx       # App queue cluster node
│   │   │   ├── ChannelEdge.tsx        # Animated channel edge
│   │   │   ├── XmitEdge.tsx           # Dashed rewiring edge
│   │   │   ├── TopologyLegend.tsx     # Color + shape legend
│   │   │   └── TopologyControls.tsx   # Fit / zoom / layout buttons
│   │   ├── migration/
│   │   │   ├── MigrationPage.tsx      # Full migration console
│   │   │   ├── MigrationStepper.tsx   # Vertical 6-step progress stepper
│   │   │   ├── AppMigrationCard.tsx   # Per-app card with state + actions
│   │   │   ├── StateBadge.tsx         # Animated state pill
│   │   │   ├── MigrationTimeline.tsx  # Horizontal timeline of all apps
│   │   │   └── MigrationControls.tsx  # Trigger / rollback buttons
│   │   ├── validation/
│   │   │   ├── ValidationPage.tsx     # Full validation dashboard
│   │   │   ├── ValidationMatrix.tsx   # App × Phase grid
│   │   │   ├── ValidationBadge.tsx    # Pass/fail with latency
│   │   │   ├── LatencySparkline.tsx   # Mini Recharts line chart
│   │   │   └── ValidationDetail.tsx   # Slide-out panel per result
│   │   ├── audit/
│   │   │   ├── AuditPage.tsx          # Full audit + rollback view
│   │   │   ├── AuditTimeline.tsx      # Time-ordered event stream
│   │   │   ├── AuditEntry.tsx         # Single event row
│   │   │   ├── RollbackPanel.tsx      # Rollback state per app
│   │   │   └── EventFilters.tsx       # Filter by op / QM / agent
│   │   └── shared/
│   │       ├── QMStatusPill.tsx       # Green/red QM reachability
│   │       ├── LoadingSpinner.tsx
│   │       ├── ErrorBanner.tsx
│   │       └── LiveIndicator.tsx      # Pulsing dot = SSE connected
│   ├── hooks/
│   │   ├── useMigrationStream.ts      # SSE subscription
│   │   ├── useFleet.ts                # Fleet + QM status
│   │   ├── useMigrations.ts           # All migration records
│   │   └── useAudit.ts                # Audit log with filters
│   ├── store/
│   │   └── appStore.ts                # Zustand: migrations + fleet
│   ├── types/
│   │   └── index.ts                   # All shared types
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

## Design System

### Color Tokens

```typescript
// src/lib/colors.ts
export const STATE_COLORS = {
  IDLE:                 { bg: 'bg-slate-100',   text: 'text-slate-600',  dot: '#94a3b8', ring: '#e2e8f0' },
  SNAPSHOTTED:          { bg: 'bg-blue-100',    text: 'text-blue-700',   dot: '#3b82f6', ring: '#bfdbfe' },
  PROVISIONING_TARGET:  { bg: 'bg-amber-100',   text: 'text-amber-700',  dot: '#f59e0b', ring: '#fde68a' },
  REWIRING:             { bg: 'bg-amber-100',   text: 'text-amber-700',  dot: '#f59e0b', ring: '#fde68a' },
  VALIDATING:           { bg: 'bg-sky-100',     text: 'text-sky-700',    dot: '#0ea5e9', ring: '#bae6fd' },
  MIGRATED:             { bg: 'bg-emerald-100', text: 'text-emerald-700',dot: '#10b981', ring: '#a7f3d0' },
  ROLLING_BACK:         { bg: 'bg-red-100',     text: 'text-red-700',    dot: '#ef4444', ring: '#fecaca' },
  ROLLED_BACK:          { bg: 'bg-orange-100',  text: 'text-orange-700', dot: '#f97316', ring: '#fed7aa' },
} as const;

export const VALIDATION_COLORS = {
  pass:    { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  fail:    { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700'     },
  pending: { bg: 'bg-slate-50',   border: 'border-slate-200',   text: 'text-slate-400'   },
};
```

---

## Page 1: Topology Graph (React Flow)

### TopologyPage.tsx

```tsx
// src/pages/TopologyPage.tsx
import { useState } from 'react';
import TopologyCanvas from '../components/topology/TopologyCanvas';
import { useFleet } from '../hooks/useFleet';
import { useMigrations } from '../hooks/useMigrations';
import { Network, ArrowRight } from 'lucide-react';

export default function TopologyPage() {
  const [view, setView] = useState<'split' | 'source' | 'target'>('split');
  const { data: fleet } = useFleet();
  const { migrations } = useMigrations();

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="w-5 h-5 text-slate-600" />
          <h1 className="text-xl font-semibold text-slate-900">Topology View</h1>
        </div>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          {(['split', 'source', 'target'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                view === v
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Canvases */}
      {view === 'split' ? (
        <div className="flex gap-4 flex-1 min-h-0">
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            <div className="flex items-center gap-2 px-1">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Source Topology
              </span>
              <span className="text-xs text-slate-400">2 shared QMs • 6 apps</span>
            </div>
            <div className="flex-1 rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
              <TopologyCanvas
                queueManagers={fleet?.queue_managers.filter(q => q.role === 'source') ?? []}
                migrations={migrations}
                mode="source"
              />
            </div>
          </div>

          <div className="flex items-center self-center">
            <div className="flex flex-col items-center gap-1 text-slate-300">
              <ArrowRight className="w-6 h-6" />
              <span className="text-[10px] font-medium uppercase tracking-wider">migrate</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-2 min-w-0">
            <div className="flex items-center gap-2 px-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Target Topology
              </span>
              <span className="text-xs text-slate-400">6 dedicated QMs • 1 app each</span>
            </div>
            <div className="flex-1 rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
              <TopologyCanvas
                queueManagers={fleet?.queue_managers.filter(q => q.role === 'target') ?? []}
                migrations={migrations}
                mode="target"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
          <TopologyCanvas
            queueManagers={fleet?.queue_managers.filter(
              q => view === 'source' ? q.role === 'source' : q.role === 'target'
            ) ?? []}
            migrations={migrations}
            mode={view === 'source' ? 'source' : 'target'}
          />
        </div>
      )}
    </div>
  );
}
```

---

### QMNode.tsx — The Core Visual Element

```tsx
// src/components/topology/QMNode.tsx
import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { motion, AnimatePresence } from 'framer-motion';
import { Server, AlertCircle, CheckCircle2 } from 'lucide-react';
import { STATE_COLORS, MigrationState } from '../../types';

interface QMNodeData {
  label: string;           // QM.SRC.A
  role: 'source' | 'target';
  migrationState: MigrationState;
  appCount: number;
  queues: string[];
  isReachable: boolean;
}

const PULSING_STATES: MigrationState[] = [
  'PROVISIONING_TARGET', 'REWIRING', 'VALIDATING', 'ROLLING_BACK'
];

export const QMNode = memo(({ data, selected }: NodeProps<QMNodeData>) => {
  const colors = STATE_COLORS[data.migrationState];
  const isPulsing = PULSING_STATES.includes(data.migrationState);
  const isMigrated = data.migrationState === 'MIGRATED';

  return (
    <div
      className={`
        relative min-w-[180px] rounded-xl border-2 bg-white shadow-md
        transition-all duration-300
        ${selected ? 'shadow-lg shadow-blue-100' : ''}
        ${isMigrated ? 'border-emerald-400' : 'border-slate-200'}
      `}
    >
      {/* Pulse ring for active states */}
      <AnimatePresence>
        {isPulsing && (
          <motion.div
            className="absolute inset-0 rounded-xl"
            initial={{ opacity: 0.6, scale: 1 }}
            animate={{ opacity: 0, scale: 1.12 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
            style={{ border: `2px solid ${colors.dot}`, pointerEvents: 'none' }}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-t-xl ${
        data.role === 'source' ? 'bg-slate-100' : 'bg-emerald-50'
      }`}>
        <Server className={`w-4 h-4 ${
          data.role === 'source' ? 'text-slate-500' : 'text-emerald-600'
        }`} />
        <span className="text-xs font-semibold text-slate-700 truncate">
          {data.label}
        </span>
        {data.isReachable
          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-auto shrink-0" />
          : <AlertCircle className="w-3.5 h-3.5 text-red-400 ml-auto shrink-0" />
        }
      </div>

      {/* Body */}
      <div className="px-3 py-2 space-y-1.5">
        {/* Migration state badge */}
        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${colors.bg} ${colors.text}`}>
          <motion.span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: colors.dot }}
            animate={isPulsing ? { opacity: [1, 0.3, 1] } : {}}
            transition={{ duration: 1, repeat: Infinity }}
          />
          {data.migrationState}
        </div>

        {/* Queue list */}
        <div className="space-y-0.5">
          {data.queues.slice(0, 4).map((q) => (
            <div key={q} className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
              <span className="truncate font-mono">{q}</span>
            </div>
          ))}
          {data.queues.length > 4 && (
            <div className="text-[10px] text-slate-400 pl-2.5">
              +{data.queues.length - 4} more queues
            </div>
          )}
        </div>

        {/* App count */}
        <div className="text-[10px] text-slate-400 pt-0.5">
          {data.appCount} app{data.appCount !== 1 ? 's' : ''} bound
        </div>
      </div>

      <Handle type="target" position={Position.Left} className="!bg-slate-400 !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-slate-400 !w-2 !h-2" />
    </div>
  );
});

QMNode.displayName = 'QMNode';
```

---

### ChannelEdge.tsx — Animated Rewiring Visualization

```tsx
// src/components/topology/ChannelEdge.tsx
import { memo } from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer } from 'reactflow';

interface ChannelEdgeData {
  label: string;
  state: string;
  isRewiring: boolean;
}

export const ChannelEdge = memo(({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data,
}: EdgeProps<ChannelEdgeData>) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const isActive = data?.isRewiring;
  const color = isActive ? '#f59e0b' : '#94a3b8';

  return (
    <>
      {/* Shadow/glow for active rewiring */}
      {isActive && (
        <path
          d={edgePath}
          fill="none"
          stroke={color}
          strokeWidth={6}
          opacity={0.2}
          strokeLinecap="round"
        />
      )}

      {/* Main edge */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={isActive ? 2.5 : 1.5}
        strokeDasharray={isActive ? '8 4' : undefined}
        strokeLinecap="round"
        style={isActive ? {
          animation: 'dash-move 0.8s linear infinite',
        } : undefined}
      />

      {/* Arrow head */}
      <defs>
        <marker id={`arrow-${id}`} markerWidth="8" markerHeight="8"
          refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill={color} />
        </marker>
      </defs>

      {/* Label */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
          className={`
            nodrag nopan px-1.5 py-0.5 rounded text-[10px] font-mono
            pointer-events-none select-none
            ${isActive
              ? 'bg-amber-100 text-amber-700 border border-amber-200'
              : 'bg-white text-slate-400 border border-slate-100'
            }
          `}
        >
          {data?.label}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

ChannelEdge.displayName = 'ChannelEdge';
```

---

## Page 2: Migration Console

### MigrationPage.tsx

```tsx
// src/pages/MigrationPage.tsx
import { Layers } from 'lucide-react';
import MigrationTimeline from '../components/migration/MigrationTimeline';
import AppMigrationCard from '../components/migration/AppMigrationCard';
import { useMigrations } from '../hooks/useMigrations';
import { useMigrationStream } from '../hooks/useMigrationStream';
import LiveIndicator from '../components/shared/LiveIndicator';

const APPS = [
  { id: 'APP1', source: 'QM.SRC.A', target: 'QM.APP1' },
  { id: 'APP2', source: 'QM.SRC.A', target: 'QM.APP2' },
  { id: 'APP3', source: 'QM.SRC.A', target: 'QM.APP3' },
  { id: 'APP4', source: 'QM.SRC.B', target: 'QM.APP4' },
  { id: 'APP5', source: 'QM.SRC.B', target: 'QM.APP5' },
  { id: 'APP6', source: 'QM.SRC.B', target: 'QM.APP6' },
];

export default function MigrationPage() {
  const { migrations, triggerMigration, isLoading } = useMigrations();
  useMigrationStream();

  const migratedCount = Object.values(migrations).filter(
    m => m.state === 'MIGRATED'
  ).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-slate-600" />
          <h1 className="text-xl font-semibold text-slate-900">Migration Console</h1>
        </div>
        <div className="flex items-center gap-3">
          <LiveIndicator />
          <div className="text-sm text-slate-500">
            <span className="font-semibold text-slate-900">{migratedCount}</span>
            /6 apps migrated
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-700"
          style={{ width: `${(migratedCount / 6) * 100}%` }}
        />
      </div>

      {/* Timeline overview */}
      <MigrationTimeline apps={APPS} migrations={migrations} />

      {/* Per-app cards — 2 columns */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {APPS.map((app) => (
          <AppMigrationCard
            key={app.id}
            app={app}
            record={migrations[app.id]}
            onMigrate={() => triggerMigration(app.id, app.source, app.target)}
            isLoading={isLoading}
          />
        ))}
      </div>
    </div>
  );
}
```

---

### AppMigrationCard.tsx

```tsx
// src/components/migration/AppMigrationCard.tsx
import { motion } from 'framer-motion';
import { Play, RotateCcw, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { useState } from 'react';
import { MigrationRecord } from '../../types';
import StateBadge from './StateBadge';
import MigrationStepper from './MigrationStepper';
import { formatDistanceToNow } from 'date-fns';

interface AppConfig { id: string; source: string; target: string; }

interface Props {
  app: AppConfig;
  record: MigrationRecord | undefined;
  onMigrate: () => void;
  isLoading: boolean;
}

export default function AppMigrationCard({ app, record, onMigrate, isLoading }: Props) {
  const [expanded, setExpanded] = useState(false);
  const state = record?.state ?? 'IDLE';
  const canMigrate = state === 'IDLE' || state === 'ROLLED_BACK';
  const isActive = ['SNAPSHOTTED', 'PROVISIONING_TARGET', 'REWIRING',
                    'VALIDATING', 'ROLLING_BACK'].includes(state);

  return (
    <motion.div
      layout
      className={`
        rounded-xl border bg-white overflow-hidden transition-all duration-300
        ${isActive ? 'border-amber-200 shadow-amber-50 shadow-md' : ''}
        ${state === 'MIGRATED' ? 'border-emerald-200' : ''}
        ${state === 'ROLLED_BACK' ? 'border-orange-200' : ''}
        ${state === 'IDLE' ? 'border-slate-200' : ''}
      `}
    >
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* App ID */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className={`
            w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm
            ${state === 'MIGRATED'  ? 'bg-emerald-100 text-emerald-700' : ''}
            ${state === 'IDLE'      ? 'bg-slate-100 text-slate-500'     : ''}
            ${isActive              ? 'bg-amber-100 text-amber-700'     : ''}
            ${state === 'ROLLED_BACK' ? 'bg-orange-100 text-orange-700' : ''}
          `}>
            {app.id.replace('APP', '')}
          </div>
          <div>
            <div className="font-semibold text-slate-800 text-sm">{app.id}</div>
            <div className="text-[11px] text-slate-400 font-mono">
              {app.source} → {app.target}
            </div>
          </div>
        </div>

        {/* State badge */}
        <StateBadge state={state} />

        {/* Actions */}
        <div className="flex items-center gap-1 ml-2">
          {canMigrate && (
            <button
              onClick={onMigrate}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              <Play className="w-3 h-3" />
              Migrate
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            {expanded
              ? <ChevronUp className="w-4 h-4 text-slate-400" />
              : <ChevronDown className="w-4 h-4 text-slate-400" />
            }
          </button>
        </div>
      </div>

      {/* Timestamps */}
      {record?.started_at && (
        <div className="flex items-center gap-1.5 px-4 pb-2 text-[11px] text-slate-400">
          <Clock className="w-3 h-3" />
          Started {formatDistanceToNow(new Date(record.started_at), { addSuffix: true })}
          {record.error && (
            <span className="ml-2 text-red-400">• {record.error}</span>
          )}
        </div>
      )}

      {/* Expanded stepper */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-slate-100"
          >
            <MigrationStepper record={record} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
```

---

### MigrationStepper.tsx — 6-Step Visual Stepper

```tsx
// src/components/migration/MigrationStepper.tsx
import { Check, Loader2, X, Clock } from 'lucide-react';
import { MigrationRecord, MigrationState } from '../../types';

const STEPS: { id: MigrationState; label: string; description: string }[] = [
  { id: 'SNAPSHOTTED',          label: 'Snapshot',        description: 'Pre-migration state saved to Redis' },
  { id: 'PROVISIONING_TARGET',  label: 'Provision',       description: 'New QM pod + DLQ created on OCP' },
  { id: 'REWIRING',             label: 'Rewire',          description: 'Xmit queue + remote def installed' },
  { id: 'VALIDATING',           label: 'Validate',        description: 'Message flow tests running' },
  { id: 'MIGRATED',             label: 'Migrated',        description: 'App isolated on dedicated QM' },
  { id: 'ROLLING_BACK',         label: 'Roll back',       description: 'Restoring from snapshot' },
];

const STATE_ORDER: MigrationState[] = [
  'IDLE', 'SNAPSHOTTED', 'PROVISIONING_TARGET',
  'REWIRING', 'VALIDATING', 'MIGRATED',
];

function stepStatus(stepId: MigrationState, currentState: MigrationState) {
  if (currentState === 'ROLLING_BACK' || currentState === 'ROLLED_BACK') {
    return stepId === 'ROLLING_BACK' ? 'active' : 'error';
  }
  const currentIdx = STATE_ORDER.indexOf(currentState);
  const stepIdx = STATE_ORDER.indexOf(stepId);
  if (stepIdx < 0) return 'pending';
  if (stepIdx < currentIdx) return 'done';
  if (stepIdx === currentIdx) return 'active';
  return 'pending';
}

export default function MigrationStepper({ record }: { record?: MigrationRecord }) {
  const state = record?.state ?? 'IDLE';

  return (
    <div className="px-4 py-4 space-y-1">
      {STEPS.map((step, i) => {
        const status = stepStatus(step.id, state);
        return (
          <div key={step.id} className="flex gap-3">
            {/* Connector line */}
            <div className="flex flex-col items-center">
              <div className={`
                w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold
                ${status === 'done'    ? 'bg-emerald-500 text-white' : ''}
                ${status === 'active'  ? 'bg-amber-400 text-white animate-pulse' : ''}
                ${status === 'error'   ? 'bg-red-400 text-white' : ''}
                ${status === 'pending' ? 'bg-slate-100 text-slate-400' : ''}
              `}>
                {status === 'done'    && <Check className="w-3 h-3" />}
                {status === 'active'  && <Loader2 className="w-3 h-3 animate-spin" />}
                {status === 'error'   && <X className="w-3 h-3" />}
                {status === 'pending' && <span>{i + 1}</span>}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-0.5 flex-1 mt-1 min-h-[16px] ${
                  status === 'done' ? 'bg-emerald-200' : 'bg-slate-100'
                }`} />
              )}
            </div>

            {/* Step content */}
            <div className={`pb-4 ${i === STEPS.length - 1 ? 'pb-0' : ''}`}>
              <div className={`text-sm font-medium ${
                status === 'pending' ? 'text-slate-400' : 'text-slate-800'
              }`}>
                {step.label}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">{step.description}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

---

## Page 3: Validation Dashboard

### ValidationPage.tsx

```tsx
// src/pages/ValidationPage.tsx
import { useQuery } from '@tanstack/react-query';
import { bclClient } from '../api/client';
import ValidationBadge from '../components/validation/ValidationBadge';
import LatencySparkline from '../components/validation/LatencySparkline';
import { ShieldCheck } from 'lucide-react';

const APPS = ['APP1', 'APP2', 'APP3', 'APP4', 'APP5', 'APP6'];
const PHASES = ['BASELINE', 'POST_REWIRE', 'FINAL'] as const;

export default function ValidationPage() {
  const { data: allValidation } = useQuery({
    queryKey: ['all-validation'],
    queryFn: async () => {
      const results = await Promise.all(
        APPS.map(app =>
          bclClient.get(`/api/validate/${app}/history`)
            .then(r => ({ app, results: r.data.results as any[] }))
            .catch(() => ({ app, results: [] }))
        )
      );
      return Object.fromEntries(results.map(r => [r.app, r.results]));
    },
    refetchInterval: 8000,
  });

  const totalPassed = APPS.flatMap(app =>
    PHASES.map(phase =>
      (allValidation?.[app] ?? []).find((r: any) => r.phase === phase)?.passed
    )
  ).filter(Boolean).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-slate-600" />
          <h1 className="text-xl font-semibold text-slate-900">Validation Matrix</h1>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-emerald-600 font-semibold">{totalPassed}</span>
          <span className="text-slate-400">/ {APPS.length * PHASES.length} checks passed</span>
        </div>
      </div>

      {/* Matrix */}
      <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">
                Application
              </th>
              {PHASES.map(phase => (
                <th key={phase} className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <div>{phase.replace('_', ' ')}</div>
                  <div className="text-[10px] font-normal text-slate-400 normal-case tracking-normal mt-0.5">
                    {phase === 'BASELINE' && 'pre-migration'}
                    {phase === 'POST_REWIRE' && 'transparent route'}
                    {phase === 'FINAL' && 'post-cutover'}
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Latency trend
              </th>
            </tr>
          </thead>
          <tbody>
            {APPS.map((app, i) => {
              const appResults = allValidation?.[app] ?? [];
              const latencies = PHASES.map(phase =>
                appResults.find((r: any) => r.phase === phase)?.latency_ms
              ).filter(Boolean) as number[];

              return (
                <tr
                  key={app}
                  className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                    i === APPS.length - 1 ? 'border-b-0' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-800 text-sm">{app}</div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {app.replace('APP', 'QM.APP')}
                    </div>
                  </td>
                  {PHASES.map(phase => {
                    const result = appResults.find((r: any) => r.phase === phase);
                    return (
                      <td key={phase} className="px-4 py-3 text-center">
                        <ValidationBadge result={result} />
                      </td>
                    );
                  })}
                  <td className="px-4 py-3">
                    <LatencySparkline latencies={latencies} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Latency stats */}
      <div className="grid grid-cols-3 gap-4">
        {(['BASELINE', 'POST_REWIRE', 'FINAL'] as const).map(phase => {
          const values = APPS
            .flatMap(app => (allValidation?.[app] ?? []).filter((r: any) => r.phase === phase))
            .map((r: any) => r.latency_ms)
            .filter(Boolean) as number[];
          const avg = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
          const max = values.length ? Math.max(...values) : null;

          return (
            <div key={phase} className="rounded-xl border border-slate-200 bg-white px-4 py-4">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                {phase.replace('_', ' ')}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">
                  {avg ?? '—'}
                </span>
                {avg && <span className="text-sm text-slate-400">ms avg</span>}
              </div>
              {max && (
                <div className="text-xs text-slate-400 mt-1">
                  max {max} ms
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

### ValidationBadge.tsx

```tsx
// src/components/validation/ValidationBadge.tsx
import { Check, X, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  result?: { passed: boolean; latency_ms: number };
}

export default function ValidationBadge({ result }: Props) {
  if (!result) {
    return (
      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100">
        <Clock className="w-3.5 h-3.5 text-slate-300" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="inline-flex flex-col items-center gap-0.5"
    >
      <div className={`
        w-8 h-8 rounded-full flex items-center justify-center
        ${result.passed ? 'bg-emerald-100' : 'bg-red-100'}
      `}>
        {result.passed
          ? <Check className="w-4 h-4 text-emerald-600" />
          : <X className="w-4 h-4 text-red-500" />
        }
      </div>
      <span className={`text-[10px] font-medium tabular-nums ${
        result.passed ? 'text-emerald-600' : 'text-red-500'
      }`}>
        {result.latency_ms}ms
      </span>
    </motion.div>
  );
}
```

---

## Page 4: Rollback and Audit Log

### AuditPage.tsx

```tsx
// src/pages/AuditPage.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { bclClient } from '../api/client';
import { ScrollText, Filter } from 'lucide-react';
import AuditTimeline from '../components/audit/AuditTimeline';
import RollbackPanel from '../components/audit/RollbackPanel';
import EventFilters from '../components/audit/EventFilters';
import { useMigrations } from '../hooks/useMigrations';

export default function AuditPage() {
  const [filters, setFilters] = useState({ operation: '', qm: '', agent: '' });
  const { migrations } = useMigrations();

  const rolledBackApps = Object.values(migrations).filter(
    m => m.state === 'ROLLED_BACK'
  );

  const { data } = useQuery({
    queryKey: ['audit', filters],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '200' });
      if (filters.operation) params.set('operation', filters.operation);
      if (filters.qm) params.set('qm', filters.qm);
      const { data } = await bclClient.get(`/api/audit?${params}`);
      return data.events;
    },
    refetchInterval: 5000,
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScrollText className="w-5 h-5 text-slate-600" />
          <h1 className="text-xl font-semibold text-slate-900">Audit Log</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="font-semibold text-slate-900">{data?.length ?? 0}</span>
          events
        </div>
      </div>

      {/* Rollback alerts (if any) */}
      {rolledBackApps.length > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <div className="text-sm font-semibold text-orange-800 mb-3">
            Rollback Events ({rolledBackApps.length})
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rolledBackApps.map(app => (
              <RollbackPanel key={app.app_id} record={app} />
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <EventFilters filters={filters} onChange={setFilters} />

      {/* Timeline */}
      <AuditTimeline events={data ?? []} />
    </div>
  );
}
```

---

### AuditTimeline.tsx

```tsx
// src/components/audit/AuditTimeline.tsx
import { formatDistanceToNow } from 'date-fns';
import { AuditEvent } from '../../types';
import { motion } from 'framer-motion';

const OP_COLORS: Record<string, string> = {
  CREATE_QUEUE:    'bg-blue-100 text-blue-700',
  CREATE_CHANNEL:  'bg-sky-100 text-sky-700',
  VALIDATION:      'bg-emerald-100 text-emerald-700',
  ROLLBACK:        'bg-orange-100 text-orange-700',
  DELETE_QUEUE:    'bg-red-100 text-red-700',
  MIGRATE:         'bg-amber-100 text-amber-700',
};

export default function AuditTimeline({ events }: { events: AuditEvent[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-50">
        {events.length === 0 && (
          <p className="text-center text-slate-400 py-12 text-sm">
            No audit events yet. Provision or migrate to see activity.
          </p>
        )}
        {events.map((event, i) => (
          <motion.div
            key={`${event.timestamp}-${i}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i < 20 ? i * 0.02 : 0 }}
            className="flex items-center gap-4 px-4 py-2.5 hover:bg-slate-50 transition-colors text-sm"
          >
            {/* Timestamp */}
            <span className="text-slate-400 tabular-nums text-xs w-24 shrink-0">
              {formatDistanceToNow(new Date(event.timestamp * 1000), { addSuffix: true })}
            </span>

            {/* Operation badge */}
            <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 font-mono ${
              OP_COLORS[event.operation] ?? 'bg-slate-100 text-slate-600'
            }`}>
              {event.operation}
            </span>

            {/* QM */}
            <span className="text-slate-500 font-mono text-xs w-28 shrink-0 truncate">
              {event.qm_target}
            </span>

            {/* Agent */}
            <span className="text-slate-400 text-xs w-36 shrink-0 truncate">
              {event.agent}
            </span>

            {/* Result */}
            <span className={`text-xs font-medium ml-auto shrink-0 ${
              event.result === 'SUCCESS' || event.result === 'PASS'
                ? 'text-emerald-600'
                : event.result === 'FAIL' || event.result === 'ERROR'
                ? 'text-red-500'
                : 'text-amber-600'
            }`}>
              {event.result}
            </span>

            {/* Trace ID */}
            {event.trace_id && (
              <span className="text-slate-300 font-mono text-[10px] shrink-0">
                {event.trace_id.slice(0, 8)}
              </span>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
```

---

## App Shell + Sidebar

```tsx
// src/components/layout/AppShell.tsx
import { NavLink, Outlet } from 'react-router-dom';
import { Network, Layers, ShieldCheck, ScrollText } from 'lucide-react';
import TopBar from './TopBar';

const NAV = [
  { to: '/topology',   icon: Network,      label: 'Topology'   },
  { to: '/migration',  icon: Layers,       label: 'Migration'  },
  { to: '/validation', icon: ShieldCheck,  label: 'Validation' },
  { to: '/audit',      icon: ScrollText,   label: 'Audit'      },
];

export default function AppShell() {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-900 flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="text-white font-bold text-base tracking-tight">MQ Control Plane</div>
          <div className="text-slate-400 text-xs mt-0.5">IBM MQ Migration</div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                transition-all duration-150
                ${isActive
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }
              `}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom status */}
        <div className="px-4 py-4 border-t border-slate-800">
          <div className="text-[11px] text-slate-500 font-medium uppercase tracking-wider mb-2">
            Fleet Status
          </div>
          <FleetStatusMini />
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

---

## Package.json Dependencies

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.26.0",
    "reactflow": "^11.11.4",
    "@tanstack/react-query": "^5.56.0",
    "zustand": "^4.5.5",
    "axios": "^1.7.7",
    "framer-motion": "^11.5.4",
    "recharts": "^2.13.0",
    "lucide-react": "^0.441.0",
    "date-fns": "^3.6.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.2"
  },
  "devDependencies": {
    "typescript": "^5.5.3",
    "vite": "^5.4.8",
    "@vitejs/plugin-react": "^4.3.1",
    "tailwindcss": "^3.4.11",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "@playwright/test": "^1.47.2"
  }
}
```

---

## CSS Animation for Dashed Edge

```css
/* src/index.css */
@keyframes dash-move {
  to { stroke-dashoffset: -24; }
}
```

---

## Success Criteria

| Criterion | What judges see |
|-----------|----------------|
| Topology graph — side-by-side source + target | Two React Flow canvases, nodes animate between them |
| QM nodes pulse during active migration | Framer Motion ring animation visible while REWIRING |
| Channel edges animate during rewiring | Dashed moving edge between source and target QM |
| Migration console — 6 app cards with stepper | Expand any card to see 6-step progress |
| Real-time state updates | No page refresh — badge changes live via SSE |
| Validation matrix — 6 × 3 = 18 cells | Green checkmarks fill in after each migration |
| Latency sparklines per app | Recharts mini-chart showing ms across 3 phases |
| Audit log — color-coded, time-ordered | 200 events with operation badges and result colors |
| Rollback panel appears on ROLLED_BACK | Orange alert section surfaces automatically |
| Dark sidebar navigation | Professional look, active route highlighted |
