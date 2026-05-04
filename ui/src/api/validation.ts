import { bclClient, IS_MOCK } from './client';
import { mockApi } from './mock/service';
import type { ValidationResult, ValidationSimResult } from '../types';

export async function fetchValidationHistory(appId: string): Promise<ValidationResult[]> {
  if (IS_MOCK) return mockApi.getValidationHistory(appId);
  const { data } = await bclClient.get(`/api/validate/${appId}/history`);
  return data.results ?? [];
}

export async function runValidationSimulation(): Promise<ValidationSimResult> {
  if (IS_MOCK) return mockApi.runValidationSimulation();
  const { data } = await bclClient.post('/api/validate/simulation');
  return data;
}
