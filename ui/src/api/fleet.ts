import { bclClient } from './client';
import type { Fleet, QueueManager } from '../types';

export async function fetchFleet(): Promise<Fleet> {
  const { data } = await bclClient.get('/api/fleet');
  return data;
}

export async function fetchQMStatus(qmName: string): Promise<QueueManager> {
  const { data } = await bclClient.get(`/api/fleet/${qmName}/status`);
  return data;
}
