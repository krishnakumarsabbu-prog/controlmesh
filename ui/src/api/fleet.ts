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
