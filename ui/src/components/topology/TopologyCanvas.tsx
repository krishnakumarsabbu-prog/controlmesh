import { useMemo, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { QMNode, type QMNodeData } from './QMNode';
import { ChannelEdge } from './ChannelEdge';
import TopologyLegend from './TopologyLegend';
import type { QueueManagerFleet, MigrationRecord } from '../../types';

const nodeTypes = { qmNode: QMNode };
const edgeTypes = { channelEdge: ChannelEdge };

const APP_QUEUES: Record<string, string[]> = {
  // Source QMs (legacy dot-notation)
  'QM.SRC.A': ['APP1.REQUEST', 'APP2.REQUEST', 'APP3.REQUEST', 'APP1.REPLY', 'APP2.REPLY'],
  'QM.SRC.B': ['APP4.REQUEST', 'APP5.REQUEST', 'APP6.REQUEST', 'APP4.REPLY', 'APP5.REPLY'],
  // Source QMs (provisioned fleet names)
  'QM1': ['APPA.REQUEST', 'APPB.REQUEST', 'APPC.REQUEST', 'APPA.REPLY', 'APPB.REPLY'],
  'QM2': ['APPD.REQUEST', 'APPE.REQUEST', 'APPF.REQUEST', 'APPD.REPLY', 'APPE.REPLY'],
  // Target QMs — generated topology
  'QM_APP_A': ['APPA.REQUEST', 'APPA.REPLY', 'APPA.DLQ'],
  'QM_APP_B': ['APPB.REQUEST', 'APPB.REPLY', 'APPB.DLQ'],
  'QM_APP_C': ['APPC.REQUEST', 'APPC.REPLY', 'APPC.DLQ'],
  'QM_APP_D': ['APPD.REQUEST', 'APPD.REPLY', 'APPD.DLQ'],
  'QM_APP_E': ['APPE.REQUEST', 'APPE.REPLY', 'APPE.DLQ'],
  'QM_APP_F': ['APPF.REQUEST', 'APPF.REPLY', 'APPF.DLQ'],
};

const APP_COUNTS: Record<string, number> = {
  'QM.SRC.A': 3, 'QM.SRC.B': 3,
  'QM1': 3, 'QM2': 3,
  'QM_APP_A': 1, 'QM_APP_B': 1, 'QM_APP_C': 1,
  'QM_APP_D': 1, 'QM_APP_E': 1, 'QM_APP_F': 1,
};

interface Props {
  queueManagers: QueueManagerFleet[];
  migrations: Record<string, MigrationRecord>;
  mode: 'source' | 'target';
}

function buildLayout(qms: QueueManagerFleet[], migrations: Record<string, MigrationRecord>, mode: 'source' | 'target') {
  const nodes: Node<QMNodeData>[] = [];
  const edges: Edge[] = [];

  if (mode === 'source') {
    // 2 source QMs stacked vertically
    const sourceQMs = qms.filter((q) => q.role === 'source');
    sourceQMs.forEach((qm, i) => {
      const appMigrations = Object.values(migrations).filter((m) => m.source_qm === qm.name);
      const dominantState = appMigrations.length > 0
        ? (appMigrations.find(m => m.state === 'REWIRING')?.state
          ?? appMigrations.find(m => m.state === 'PROVISIONING_TARGET')?.state
          ?? appMigrations[0]?.state
          ?? 'IDLE')
        : 'IDLE';

      nodes.push({
        id: qm.name,
        type: 'qmNode',
        position: { x: 100, y: i * 260 + 60 },
        data: {
          label: qm.name,
          role: 'source',
          migrationState: dominantState,
          appCount: APP_COUNTS[qm.name] ?? 0,
          queues: APP_QUEUES[qm.name] ?? [],
          isReachable: qm.status !== 'unreachable',
        },
      });
    });
  } else {
    // 6 target QMs in 2 columns
    const targetQMs = qms.filter((q) => q.role === 'target');
    targetQMs.forEach((qm, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      // Support both QM_APP_A and QM.APP1 naming conventions
      const appId = qm.name.replace(/^QM[._](?:APP[._])?/, '');
      const migration = Object.values(migrations).find((m) => m.target_qm === qm.name || m.app_id === appId);

      nodes.push({
        id: qm.name,
        type: 'qmNode',
        position: { x: col * 240 + 40, y: row * 230 + 40 },
        data: {
          label: qm.name,
          role: 'target',
          migrationState: migration?.state ?? 'IDLE',
          appCount: APP_COUNTS[qm.name] ?? 1,
          queues: APP_QUEUES[qm.name] ?? [],
          isReachable: qm.status !== 'unreachable',
        },
      });
    });

    // Add edges between target QMs if they'd be connected via xmit
    // (placeholder — real topology shows after rewiring)
  }

  return { nodes, edges };
}

export default function TopologyCanvas({ queueManagers, migrations, mode }: Props) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildLayout(queueManagers, migrations, mode),
    [queueManagers, migrations, mode]
  );

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  // Sync nodes when migrations change
  const syncedNodes = useMemo(() => {
    return nodes.map((node) => {
      const qm = queueManagers.find((q) => q.name === node.id);
      if (!qm) return node;

      let migrationState = node.data.migrationState;

      if (mode === 'source') {
        const appMigrations = Object.values(migrations).filter((m) => m.source_qm === qm.name);
        if (appMigrations.length > 0) {
          migrationState = appMigrations.find(m => m.state === 'REWIRING')?.state
            ?? appMigrations.find(m => m.state === 'PROVISIONING_TARGET')?.state
            ?? appMigrations.find(m => m.state === 'VALIDATING')?.state
            ?? appMigrations[0]?.state
            ?? 'IDLE';
        }
      } else {
        const appId = qm.name.replace(/^QM[._](?:APP[._])?/, '');
        const migration = Object.values(migrations).find((m) => m.target_qm === qm.name || m.app_id === appId);
        migrationState = migration?.state ?? 'IDLE';
      }

      return { ...node, data: { ...node.data, migrationState, isReachable: qm.status !== 'unreachable' } };
    });
  }, [nodes, queueManagers, migrations, mode]);

  const onInit = useCallback((instance: { fitView: () => void }) => {
    setTimeout(() => instance.fitView(), 100);
  }, []);

  return (
    <div className="relative w-full h-full">
      <ReactFlow
        nodes={syncedNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={onInit}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
        <Controls showInteractive={false} className="!bg-white !border-slate-200 !shadow-sm" />
        <MiniMap
          nodeColor={(n) => {
            const state = (n.data as QMNodeData)?.migrationState ?? 'IDLE';
            const colors: Record<string, string> = {
              IDLE: '#94a3b8', SNAPSHOTTED: '#3b82f6',
              PROVISIONING_TARGET: '#f59e0b', REWIRING: '#f59e0b',
              VALIDATING: '#0ea5e9', MIGRATED: '#10b981',
              ROLLING_BACK: '#ef4444', ROLLED_BACK: '#f97316',
            };
            return colors[state] ?? '#94a3b8';
          }}
          className="!bg-white/80 !border-slate-200 !rounded-lg"
        />
      </ReactFlow>
      <TopologyLegend />
    </div>
  );
}
