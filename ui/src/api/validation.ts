import { bclClient, IS_MOCK } from './client';
import { mockApi } from './mock/service';
import type {
  ValidationResult,
  ValidationSimResult,
  SystemValidationResult,
  SystemValidationQM,
  SystemValidationChannel,
} from '../types';

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

export async function runSystemValidation(
  queueManagers: SystemValidationQM[],
  channels: SystemValidationChannel[],
): Promise<SystemValidationResult> {
  if (IS_MOCK) return mockApi.runSystemValidation(queueManagers, channels);
  try {
    const { data } = await bclClient.post('/api/validate/system', {
      queue_managers: queueManagers,
      channels,
    });
    return data as SystemValidationResult;
  } catch (err: unknown) {
    // 422 response contains violation detail — surface it
    const axiosErr = err as { response?: { data?: { detail?: SystemValidationResult } } };
    const detail = axiosErr?.response?.data?.detail;
    if (detail && typeof detail === 'object' && 'violations' in detail) {
      return detail as SystemValidationResult;
    }
    throw err;
  }
}
