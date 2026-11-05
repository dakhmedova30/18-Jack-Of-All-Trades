import type { Adjustment } from '../types';
import { apiRequest } from './http';

export type AdjustmentInput = Omit<Adjustment, 'id' | 'useCount' | 'amountAppliedCadCents'>;

export function listAdjustments(): Promise<Adjustment[]> {
  return apiRequest('/adjustments');
}

export function createAdjustment(input: AdjustmentInput): Promise<Adjustment> {
  return apiRequest('/adjustments', { method: 'POST', json: input });
}

export function updateAdjustment(id: number, input: AdjustmentInput): Promise<Adjustment> {
  return apiRequest(`/adjustments/${id}`, { method: 'PUT', json: input });
}

export function deactivateAdjustment(id: number): Promise<void> {
  return apiRequest(`/adjustments/${id}`, { method: 'DELETE' });
}
