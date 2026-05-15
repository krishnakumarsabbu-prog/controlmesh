import { useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  type Node,
  type Edge,
  BackgroundVariant,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { MOCK_APPLICATIONS, MOCK_FLOWS } from '../mock/data';
import { useWorkspaceStore } from '../store/workspaceStore';

// ── Custom node components ────────────────────────────────────────────────────

function ServiceNode({ data }: { data: { label: string; type: 'producer' | 'consumer'; tps: number; status: string } }) {
  const c = data.status === 'healthy' ? '#22c55e' : data.status === 'degraded' ? '#f59e0b' : '#ef4444';
  return (
    <div
      className="px-3 py-2 rounded-xl text-xs font-medium border"
      style={{
        background: data.type === 'producer' ? 'rgba(99,102,241,0.15)' : 'rgba(6,182,212,0.12)',
        borderColor: data.type === 'producer' ? 'rgba(99,102,241,0.4)' : 'rgba(6,182,212,0.35)',
        color: 'var(--text-primary)',
        minWidth: 120,
      }}
    >
      <Handle type="source" position={Position.Right} style={{ background: '#22d3ee', border: 'none', width: 8, height: 8 }} />
      <Handle type="target" position={Position.Left}  style={{ background: '#22d3ee', border: 'none', width: 8, height: 8 }} />
      <div className="font-semibold text-[11px] mb-0.5">{data.label}</div>
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
        <span className="text-text-muted">{data.tps.toLocaleString()} TPS</span>
      </div>
    </div>
  );
}

function QMNode({ data }: { data: { label: string; role: 'source' | 'target' } }) {
  const isSrc = data.role === 'source';
  return (
    <div
      className="px-4 py-3 rounded-2xl text-xs font-bold border-2 text-center"
      style={{
        background: isSrc ? 'rgba(6,182,212,0.1)' : 'rgba(168,85,247,0.1)',
        borderColor: isSrc ? 'rgba(6,182,212,0.5)' : 'rgba(168,85,247,0.5)',
        color: isSrc ? '#22d3ee' : '#c084fc',
        minWidth: 130,
        boxShadow: isSrc
          ? '0 0 20px rgba(6,182,212,0.15), inset 0 1px 0 rgba(255,255,255,0.05)'
          : '0 0 20px rgba(168,85,247,0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      <Handle type="source" position={Position.Right} style={{ background: isSrc ? '#22d3ee' : '#c084fc', border: 'none', width: 8, height: 8 }} />
      <Handle type="target" position={Position.Left}  style={{ background: isSrc ? '#22d3ee' : '#c084fc', border: 'none', width: 8, height: 8 }} />
      <div className="text-[9px] uppercase tracking-widest mb-1 opacity-70">{data.role === 'source' ? 'Source QM' : 'Target QM'}</div>
      <div>{data.label}</div>
    </div>
  );
}

const nodeTypes = {
  service: ServiceNode,
  qm: QMNode,
};

// ── Build graph data ──────────────────────────────────────────────────────────

function buildGraph(appId: string | null): { nodes: Node[]; edges: Edge[] } {
  const app = MOCK_APPLICATIONS.find(a => a.id === appId) ?? MOCK_APPLICATIONS[0];
  const flow = MOCK_FLOWS.find(f => f.appId === app.id) ?? MOCK_FLOWS[0];

  const nodes: Node[] = [
    // Producers (left column)
    ...app.producers.map((svc, i) => ({
      id: svc.id,
      type: 'service',
      position: { x: 20, y: 60 + i * 110 },
      data: { label: svc.name, type: svc.type, tps: svc.tps, status: svc.status },
    })),
    // Source QM (center-left)
    {
      id: 'qm-source',
      type: 'qm',
      position: { x: 230, y: 80 + (app.producers.length - 1) * 55 },
      data: { label: flow.sourceQM, role: 'source' },
    },
    // Target QM (center-right) — placeholder
    {
      id: 'qm-target',
      type: 'qm',
      position: { x: 520, y: 80 + (app.consumers.length - 1) * 55 },
      data: { label: flow.targetQM, role: 'target' },
    },
    // Consumers (right column)
    ...app.consumers.map((svc, i) => ({
      id: svc.id,
      type: 'service',
      position: { x: 730, y: 60 + i * 110 },
      data: { label: svc.name, type: svc.type, tps: svc.tps, status: svc.status },
    })),
  ];

  const edges: Edge[] = [
    // Producers → Source QM
    ...app.producers.map((svc) => ({
      id: `e-${svc.id}-src`,
      source: svc.id,
      target: 'qm-source',
      animated: true,
      style: { stroke: '#22d3ee', strokeWidth: 1.5, opacity: 0.7 },
    })),
    // Source QM → Target QM (active path indicator)
    {
      id: 'e-src-tgt',
      source: 'qm-source',
      target: 'qm-target',
      animated: flow.activePath !== 'source',
      label: flow.activePath === 'source' ? 'Active Path' : 'Migrating',
      labelStyle: { fill: '#22d3ee', fontSize: 10 },
      style: { stroke: flow.activePath === 'source' ? '#22d3ee' : '#c084fc', strokeWidth: 2, strokeDasharray: '5 5' },
    },
    // Target QM → Consumers
    ...app.consumers.map((svc) => ({
      id: `e-tgt-${svc.id}`,
      source: 'qm-target',
      target: svc.id,
      animated: false,
      style: { stroke: '#6366f1', strokeWidth: 1.5, opacity: 0.5 },
    })),
  ];

  return { nodes, edges };
}

// ── Canvas ────────────────────────────────────────────────────────────────────

export default function MigrationFlowCanvas() {
  const { selectedAppId } = useWorkspaceStore();
  const { nodes, edges } = buildGraph(selectedAppId);

  const onNodeClick = useCallback(() => {}, []);

  return (
    <div className="w-full h-full rounded-xl overflow-hidden border border-surface-border" style={{ background: 'var(--surface-base)' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255,255,255,0.04)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
