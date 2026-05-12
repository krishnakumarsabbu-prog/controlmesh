import { bclClient } from './client';

export interface TopologyRow {
  flow_type: string;
  producer_app_id: string;
  producer_app_name: string;
  producer_neighborhood: string;
  producer_queue_manager: string;
  producer_queue_name: string;
  producer_queue_type: string;
  transmit_queue_name: string;
  channel_name: string;
  consumer_app_id: string;
  consumer_app_name: string;
  consumer_neighborhood: string;
  consumer_queue_manager: string;
  consumer_queue_name: string;
  consumer_queue_type: string;
  [key: string]: string;
}

export interface TopologyNodeData {
  id: string;
  type: 'appNode' | 'qmNode' | 'channelNode' | 'queueNode';
  role?: 'producer' | 'consumer' | 'source' | 'target';
  label: string;
  app_id?: string;
  app_name?: string;
  neighborhood?: string;
  queue_manager?: string;
  queues?: Array<{ name: string; type: string; flow_type: string }>;
  channel_name?: string;
  source_qm?: string;
  target_qm?: string;
  flow_type?: string;
  status: 'pending' | 'provisioning' | 'success' | 'failed';
  mq_response?: Record<string, unknown>;
  provisioned_at?: number;
}

export interface TopologyEdgeData {
  id: string;
  source: string;
  target: string;
  label: string;
  type: string;
  flow_type: string;
}

export interface TopologyGraph {
  nodes: TopologyNodeData[];
  edges: TopologyEdgeData[];
  rows: TopologyRow[];
  filename?: string;
}

export interface UploadResponse {
  status: string;
  filename: string;
  row_count: number;
  node_count: number;
  edge_count: number;
  graph: TopologyGraph;
}

export interface ProvisionEvent {
  type: 'start' | 'node_provisioning' | 'node_provisioned' | 'complete' | 'error';
  node_id?: string;
  node_type?: string;
  label?: string;
  step?: string;
  status?: 'provisioning' | 'success' | 'failed';
  queue_type?: string;
  parent_qm?: string;
  source_qm?: string;
  target_qm?: string;
  mq_response?: Record<string, unknown>;
  message?: string;
  total_nodes?: number;
  ts: number;
}

export async function uploadTopologyFile(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await bclClient.post<UploadResponse>('/api/topology/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function analyzeTopology(): Promise<{ status: string; graph: TopologyGraph }> {
  const res = await bclClient.post('/api/topology/analyze');
  return res.data;
}

export async function startProvisioning(): Promise<{ session_id: string; status: string }> {
  const res = await bclClient.post('/api/topology/provision/start');
  return res.data;
}

export async function rollbackProvisioning(nodeId?: string): Promise<void> {
  await bclClient.post('/api/topology/provision/rollback', { node_id: nodeId });
}

export function openProvisionEventStream(sessionId?: string): EventSource {
  const url = sessionId
    ? `/api/topology/provision/events?session_id=${sessionId}`
    : '/api/topology/provision/events';
  return new EventSource(url);
}
