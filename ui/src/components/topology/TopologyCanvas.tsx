import { useMemo, useCallback, useEffect } from 'react';
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

import { QMNode, type QMNodeData, type QueueEntry } from './QMNode';
import { ChannelEdge } from './ChannelEdge';
import TopologyLegend from './TopologyLegend';
import type { QueueManagerFleet, MigrationRecord, TopologyChannel } from '../../types';

const nodeTypes = { qmNode: QMNode };
const edgeTypes = { channelEdge: ChannelEdge };

const APP_COUNTS: Record<string, number> = {
  'QM.SRC.A': 3, 'QM.SRC.B': 3,
  'QM1': 3, 'QM2': 3,
};

interface QMQueueMap {
  [qmName: string]: QueueEntry[];
}

interface Props {
  queueManagers: QueueManagerFleet[];
  migrations: Record<string, MigrationRecord>;
  mode: 'source' | 'target';
  queueDetails?: QMQueueMap;
  channels?: TopologyChannel[];
}

function getMigrationStateForQM(
  qmName: string,
  role: 'source' | 'target',
  migrations: Record<string, MigrationRecord>
): MigrationRecord['state'] {
  if (role === 'source') {
    const appMigrations = Object.values(migrations).filter((m) => m.source_qm === qmName);
    if (appMigrations.length === 0) return 'IDLE';
    return (
      appMigrations.find((m) => m.state === 'REWIRING')?.state
      ?? appMigrations.find((m) => m.state === 'PROVISIONING_TARGET')?.state
      ?? appMigrations.find((m) => m.state === 'VALIDATING')?.state
      ?? appMigrations[0]?.state
      ?? 'IDLE'
    );
  } else {
    const migration = Object.values(migrations).find((m) => m.target_qm === qmName);
    return migration?.state ?? 'IDLE';
  }
}

function buildLayout(
  qms: QueueManagerFleet[],
  migrations: Record<string, MigrationRecord>,
  mode: 'source' | 'target',
  queueDetails: QMQueueMap,
  channels: TopologyChannel[]
) {
  const nodes: Node<QMNodeData>[] = [];
  const edges: Edge[] = [];

  if (mode === 'source') {
    const sourceQMs = qms.filter((q) => q.role === 'source');
    sourceQMs.forEach((qm, i) => {
      const migrationState = getMigrationStateForQM(qm.name, 'source', migrations);
      const queues = queueDetails[qm.name] ?? [];

      nodes.push({
        id: qm.name,
        type: 'qmNode',
        position: { x: 100, y: i * 280 + 60 },
        data: {
          label: qm.name,
          role: 'source',
          migrationState,
          appCount: APP_COUNTS[qm.name] ?? Object.values(migrations).filter((m) => m.source_qm === qm.name).length,
          queues,
          isReachable: qm.status !== 'unreachable',
        },
      });
    });
  } else {
    const targetQMs = qms.filter((q) => q.role === 'target');
    targetQMs.forEach((qm, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const migrationState = getMigrationStateForQM(qm.name, 'target', migrations);
      const queues = queueDetails[qm.name] ?? [];

      nodes.push({
        id: qm.name,
        type: 'qmNode',
        position: { x: col * 260 + 40, y: row * 250 + 40 },
        data: {
          label: qm.name,
          role: 'target',
          migrationState,
          appCount: APP_COUNTS[qm.name] ?? 1,
          queues,
          isReachable: qm.status !== 'unreachable',
        },
      });
    });
  }

  // Add channel edges for rewiring visualization
  channels.forEach((ch) => {
    const sourceExists = nodes.some((n) => n.id === ch.sourceQM);
    const targetExists = nodes.some((n) => n.id === ch.targetQM);
    if (sourceExists && targetExists) {
      edges.push({
        id: ch.id,
        source: ch.sourceQM,
        target: ch.targetQM,
        type: 'channelEdge',
        data: { label: ch.name, isRewiring: ch.isRewiring },
      });
    }
  });

  return { nodes, edges };
}

export default function TopologyCanvas({ queueManagers, migrations, mode, queueDetails = {}, channels = [] }: Props) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildLayout(queueManagers, migrations, mode, queueDetails, channels),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(queueManagers), JSON.stringify(migrations), mode, JSON.stringify(queueDetails), JSON.stringify(channels)]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync nodes when data changes
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = buildLayout(queueManagers, migrations, mode, queueDetails, channels);
    setNodes(newNodes);
    setEdges(newEdges);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(queueManagers), JSON.stringify(migrations), mode, JSON.stringify(queueDetails), JSON.stringify(channels)]);

  const onInit = useCallback((instance: { fitView: () => void }) => {
    setTimeout(() => instance.fitView(), 100);
  }, []);

  return (
    <div className="relative w-full h-full">
      <ReactFlow
        nodes={nodes}
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
