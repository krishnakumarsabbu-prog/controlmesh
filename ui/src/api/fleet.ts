import { bclClient, IS_MOCK } from './client';
import { mockApi } from './mock/service';
import type { Fleet, QueueManagerFleet } from '../types';

export async function fetchFleet(): Promise<Fleet> {
  if (IS_MOCK) return mockApi.getFleet();
  const { data } = await bclClient.get('/api/fleet');
  return data;
}

export async function fetchQMStatus(qmName: string): Promise<QueueManagerFleet> {
  if (IS_MOCK) return mockApi.getQMStatus(qmName);
  const { data } = await bclClient.get(`/api/fleet/${qmName}/status`);
  return data;
}

export async function provisionTopology(): Promise<{ status: string; topology: unknown }> {
  if (IS_MOCK) {
    return { status: 'provisioned', topology: {} };
  }
  const { data } = await bclClient.post('/api/topology/provision');
  return data;
}

export interface TargetQM {
  name: string;
  role: 'target';
  apps: string[];
  queues: { name: string; type: string; shared: boolean }[];
}

export interface TargetTopology {
  queue_managers: TargetQM[];
  channels: unknown[];
  applications: string[];
  total_queue_managers: number;
  total_apps: number;
  total_channels: number;
}

export async function fetchTargetTopology(): Promise<TargetTopology> {
  if (IS_MOCK) {
    const apps = ['AppA', 'AppB', 'AppC', 'AppD', 'AppE', 'AppF'];
    return {
      queue_managers: apps.map((app) => ({
        name: `QM_${app.toUpperCase()}`,
        role: 'target' as const,
        apps: [app],
        queues: [
          { name: `${app.toUpperCase()}.REQUEST`, type: 'LOCAL', shared: false },
          { name: `${app.toUpperCase()}.REPLY`, type: 'LOCAL', shared: false },
          { name: `${app.toUpperCase()}.DLQ`, type: 'LOCAL', shared: false },
        ],
      })),
      channels: [],
      applications: apps,
      total_queue_managers: 6,
      total_apps: 6,
      total_channels: 0,
    };
  }
  const { data } = await bclClient.get('/api/topology/target');
  return data.topology;
}
