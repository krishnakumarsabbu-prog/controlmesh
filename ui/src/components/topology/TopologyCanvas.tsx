import React, { useMemo, useCallback, useEffect, useState } from 'react';
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
import { AppNode, type AppNodeData } from './AppNode';
import { QueueNode, type QueueNodeData } from './QueueNode';
import { ChannelEdge } from './ChannelEdge';
import NodeDetailsPanel from './NodeDetailsPanel';
import TopologyLegend from './TopologyLegend';
import type { QueueManagerFleet, MigrationRecord, TopologyChannel } from '../../types';

const nodeTypes = { qmNode: QMNode, appNode: AppNode, queueNode: QueueNode };
const edgeTypes = { channelEdge: ChannelEdge };

// Apps per source QM for demo purposes
const SOURCE_QM_APPS: Record<string, string[]> = {
  'QM.SRC.A': ['APP1', 'APP2'],
  'QM.SRC.B': ['APP3', 'APP4', 'APP5', 'APP6'],
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
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // ── QM nodes ─────────────────────────────────────────────────────────────
  if (mode === 'source') {
    const sourceQMs = qms.filter((q) => q.role === 'source');

    sourceQMs.forEach((qm, qmIdx) => {
      const migrationState = getMigrationStateForQM(qm.name, 'source', migrations);
      const queues = queueDetails[qm.name] ?? [];
      const apps = SOURCE_QM_APPS[qm.name] ?? Object.values(migrations)
        .filter((m) => m.source_qm === qm.name)
        .map((m) => m.app_id);

      const qmX = 260;
      const qmY = qmIdx * 440 + 60;

      // QM node
      nodes.push({
        id: qm.name,
        type: 'qmNode',
        position: { x: qmX, y: qmY },
        data: {
          label: qm.name,
          role: 'source',
          migrationState,
          appCount: apps.length,
          queues,
          isReachable: qm.status !== 'unreachable',
        } satisfies QMNodeData,
      });

      // App nodes (left of QM)
      apps.forEach((appId, i) => {
        const migration = Object.values(migrations).find((m) => m.app_id === appId);
        const nodeId = `app-${appId}`;
        nodes.push({
          id: nodeId,
          type: 'appNode',
          position: { x: 20, y: qmY + i * 80 + 20 },
          data: {
            label: appId,
            sourceQM: qm.name,
            targetQM: migration?.target_qm,
            migrationState: migration?.state,
          } satisfies AppNodeData,
        });
        edges.push({
          id: `e-${nodeId}-${qm.name}`,
          source: nodeId,
          target: qm.name,
          type: 'default',
          style: { stroke: '#93c5fd', strokeWidth: 1.5 },
          markerEnd: { type: 'arrowclosed' as const, color: '#93c5fd' },
        });
      });

      // Queue nodes (right of QM)
      const visibleQueues = queues.slice(0, 6);
      visibleQueues.forEach((q, i) => {
        const nodeId = `queue-${qm.name}-${q.name}`;
        nodes.push({
          id: nodeId,
          type: 'queueNode',
          position: { x: 520, y: qmY + i * 68 + 10 },
          data: {
            label: q.name,
            queueType: q.type,
            ownerQM: qm.name,
            remoteQM: q.remoteQM,
          } satisfies QueueNodeData,
        });
        edges.push({
          id: `e-${qm.name}-${nodeId}`,
          source: qm.name,
          target: nodeId,
          type: 'default',
          style: {
            stroke: q.type === 'remote' ? '#fbbf24' : q.type === 'xmit' ? '#7dd3fc' : '#cbd5e1',
            strokeWidth: 1.5,
          },
          markerEnd: {
            type: 'arrowclosed' as const,
            color: q.type === 'remote' ? '#fbbf24' : q.type === 'xmit' ? '#7dd3fc' : '#cbd5e1',
          },
        });
      });
    });
  } else {
    // Target mode: QM nodes in 2-column grid with their queues to the right
    const targetQMs = qms.filter((q) => q.role === 'target');
    targetQMs.forEach((qm, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const migrationState = getMigrationStateForQM(qm.name, 'target', migrations);
      const queues = queueDetails[qm.name] ?? [];

      const qmX = col * 400 + 20;
      const qmY = row * 240 + 40;

      nodes.push({
        id: qm.name,
        type: 'qmNode',
        position: { x: qmX, y: qmY },
        data: {
          label: qm.name,
          role: 'target',
          migrationState,
          appCount: 1,
          queues,
          isReachable: qm.status !== 'unreachable',
        } satisfies QMNodeData,
      });

      // Queue nodes to the right
      const visibleQueues = queues.slice(0, 4);
      visibleQueues.forEach((q, qi) => {
        const nodeId = `queue-${qm.name}-${q.name}`;
        nodes.push({
          id: nodeId,
          type: 'queueNode',
          position: { x: qmX + 240, y: qmY + qi * 56 },
          data: {
            label: q.name,
            queueType: q.type,
            ownerQM: qm.name,
            remoteQM: q.remoteQM,
          } satisfies QueueNodeData,
        });
        edges.push({
          id: `e-${qm.name}-${nodeId}`,
          source: qm.name,
          target: nodeId,
          type: 'default',
          style: { stroke: '#cbd5e1', strokeWidth: 1.5 },
          markerEnd: { type: 'arrowclosed' as const, color: '#cbd5e1' },
        });
      });
    });
  }

  // Channel edges between QM nodes
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

type AnyNodeData = QMNodeData | AppNodeData | QueueNodeData;

export default function TopologyCanvas({ queueManagers, migrations, mode, queueDetails = {}, channels = [] }: Props) {
  const [selectedNode, setSelectedNode] = useState<Node<AnyNodeData> | null>(null);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildLayout(queueManagers, migrations, mode, queueDetails, channels),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(queueManagers), JSON.stringify(migrations), mode, JSON.stringify(queueDetails), JSON.stringify(channels)]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = buildLayout(queueManagers, migrations, mode, queueDetails, channels);
    setNodes(newNodes);
    setEdges(newEdges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(queueManagers), JSON.stringify(migrations), mode, JSON.stringify(queueDetails), JSON.stringify(channels)]);

  const onInit = useCallback((instance: { fitView: () => void }) => {
    setTimeout(() => instance.fitView(), 100);
  }, []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode((prev) => (prev?.id === node.id ? null : node as Node<AnyNodeData>));
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
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
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
        <Controls showInteractive={false} className="!bg-white !border-slate-200 !shadow-sm" />
        <MiniMap
          nodeColor={(n) => {
            if (n.type === 'appNode') return '#3b82f6';
            if (n.type === 'queueNode') {
              const t = (n.data as QueueNodeData)?.queueType;
              return t === 'remote' ? '#fbbf24' : t === 'xmit' ? '#7dd3fc' : '#94a3b8';
            }
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

      <NodeDetailsPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
    </div>
  );
}
