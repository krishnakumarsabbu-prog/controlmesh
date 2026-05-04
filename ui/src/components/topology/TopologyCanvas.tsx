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
  MarkerType,
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

  if (mode === 'source') {
    const sourceQMs = qms.filter((q) => q.role === 'source');

    sourceQMs.forEach((qm, qmIdx) => {
      const migrationState = getMigrationStateForQM(qm.name, 'source', migrations);
      const queues = queueDetails[qm.name] ?? [];
      const apps = SOURCE_QM_APPS[qm.name] ?? Object.values(migrations)
        .filter((m) => m.source_qm === qm.name)
        .map((m) => m.app_id);

      const qmX = 280;
      const qmY = qmIdx * 460 + 60;

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

      apps.forEach((appId, i) => {
        const migration = Object.values(migrations).find((m) => m.app_id === appId);
        const nodeId = `app-${appId}`;
        nodes.push({
          id: nodeId,
          type: 'appNode',
          position: { x: 20, y: qmY + i * 85 + 20 },
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
          type: 'channelEdge',
          data: { label: '', isRewiring: false },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
        });
      });

      const visibleQueues = queues.slice(0, 6);
      visibleQueues.forEach((q, i) => {
        const nodeId = `queue-${qm.name}-${q.name}`;
        nodes.push({
          id: nodeId,
          type: 'queueNode',
          position: { x: 540, y: qmY + i * 72 + 10 },
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
          type: 'channelEdge',
          data: {
            label: '',
            isRewiring: q.type === 'xmit',
          },
        });
      });
    });
  } else {
    const targetQMs = qms.filter((q) => q.role === 'target');
    targetQMs.forEach((qm, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const migrationState = getMigrationStateForQM(qm.name, 'target', migrations);
      const queues = queueDetails[qm.name] ?? [];

      const qmX = col * 420 + 20;
      const qmY = row * 260 + 40;

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

      queues.slice(0, 4).forEach((q, qi) => {
        const nodeId = `queue-${qm.name}-${q.name}`;
        nodes.push({
          id: nodeId,
          type: 'queueNode',
          position: { x: qmX + 250, y: qmY + qi * 60 },
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
          type: 'channelEdge',
          data: { label: '', isRewiring: false },
        });
      });
    });
  }

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

export default function TopologyCanvas({
  queueManagers,
  migrations,
  mode,
  queueDetails = {},
  channels = [],
}: Props) {
  const [selectedNode, setSelectedNode] = useState<Node<AnyNodeData> | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

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

  // Compute connected node/edge IDs for the hovered or selected node
  const focusId = hoveredNodeId ?? selectedNode?.id ?? null;

  const connectedIds = useMemo(() => {
    if (!focusId) return null;
    const nodeIds = new Set<string>([focusId]);
    const edgeIds = new Set<string>();
    edges.forEach((e) => {
      if (e.source === focusId || e.target === focusId) {
        edgeIds.add(e.id);
        nodeIds.add(e.source);
        nodeIds.add(e.target);
      }
    });
    return { nodeIds, edgeIds };
  }, [focusId, edges]);

  // Apply highlight/dim to nodes
  const displayNodes = useMemo(() => {
    if (!connectedIds) return nodes;
    return nodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        highlighted: connectedIds.nodeIds.has(n.id) && n.id !== focusId,
        dimmed: !connectedIds.nodeIds.has(n.id),
      },
    }));
  }, [nodes, connectedIds, focusId]);

  // Apply highlight/dim to edges
  const displayEdges = useMemo(() => {
    if (!connectedIds) return edges;
    return edges.map((e) => ({
      ...e,
      data: {
        ...e.data,
        highlighted: connectedIds.edgeIds.has(e.id),
        dimmed: !connectedIds.edgeIds.has(e.id),
      },
    }));
  }, [edges, connectedIds]);

  const onInit = useCallback((instance: { fitView: () => void }) => {
    setTimeout(() => instance.fitView(), 100);
  }, []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode((prev) => (prev?.id === node.id ? null : node as Node<AnyNodeData>));
  }, []);

  const onNodeMouseEnter = useCallback((_: React.MouseEvent, node: Node) => {
    setHoveredNodeId(node.id);
  }, []);

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  return (
    <div className="relative w-full h-full bg-surface-base">
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={onInit}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.15}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Lines}
          gap={40}
          size={1}
          color="rgba(100,116,139,0.08)"
        />
        <Background
          id="dots"
          variant={BackgroundVariant.Dots}
          gap={40}
          size={1.2}
          color="rgba(100,116,139,0.18)"
          offset={0}
        />
        <Controls
          showInteractive={false}
          className="!bg-[#0d1220]/90 !border-slate-700 !shadow-xl !rounded-xl overflow-hidden"
          style={{ bottom: 16, right: 16, top: 'auto', left: 'auto' }}
        />
        <MiniMap
          nodeColor={(n) => {
            if (n.type === 'appNode') return '#3b82f6';
            if (n.type === 'queueNode') {
              const t = (n.data as QueueNodeData)?.queueType;
              return t === 'remote' ? '#fbbf24' : t === 'xmit' ? '#38bdf8' : '#475569';
            }
            return '#7c3aed';
          }}
          maskColor="rgba(8,11,20,0.6)"
          className="!rounded-xl !overflow-hidden"
          style={{
            background: 'rgba(8,11,20,0.92)',
            border: '1px solid rgba(100,116,139,0.25)',
            bottom: 16,
            right: 80,
          }}
        />
      </ReactFlow>

      <TopologyLegend />

      <NodeDetailsPanel
        node={selectedNode}
        edges={edges}
        nodes={nodes}
        onClose={() => setSelectedNode(null)}
      />
    </div>
  );
}
