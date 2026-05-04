import { bclClient } from './client';
import type { ValidationResult } from '../types';

export async function fetchValidationHistory(appId: string): Promise<ValidationResult[]> {
  const { data } = await bclClient.get(`/api/validate/${appId}/history`);
  return data.results ?? [];
}
