import { bclClient, IS_MOCK } from './client';
import { mockApi } from './mock/service';
import type { Fleet, QueueManager } from '../types';

export async function fetchFleet(): Promise<Fleet> {
  if (IS_MOCK) return mockApi.getFleet();
  const { data } = await bclClient.get('/api/fleet');
  return data;
}

export async function fetchQMStatus(qmName: string): Promise<QueueManager> {
  if (IS_MOCK) return mockApi.getQMStatus(qmName);
  const { data } = await bclClient.get(`/api/fleet/${qmName}/status`);
  return data;
}
