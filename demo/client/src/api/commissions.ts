import type { Commission, CommissionInput } from '../types';
import { apiRequest } from './http';

export interface ListCommissionsParams {
  search?: string;
  from?: string;
  to?: string;
  currency?: string;
}

export function listCommissions(params: ListCommissionsParams = {}): Promise<Commission[]> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  if (params.currency) query.set('currency', params.currency);
  return apiRequest(`/commissions${query.size ? `?${query}` : ''}`);
}

export function createCommission(input: CommissionInput): Promise<Commission> {
  return apiRequest('/commissions', { method: 'POST', json: input });
}

export function updateCommission(id: number, input: CommissionInput): Promise<Commission> {
  return apiRequest(`/commissions/${id}`, { method: 'PATCH', json: input });
}

export function deleteCommission(id: number): Promise<void> {
  return apiRequest(`/commissions/${id}`, { method: 'DELETE' });
}

export function bulkDeleteCommissions(ids: number[]): Promise<{ deleted: number }> {
  return apiRequest('/commissions/bulk-delete', { method: 'POST', json: { ids } });
}
