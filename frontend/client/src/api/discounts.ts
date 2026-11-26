import type { Discount, DiscountInput } from '../types';
import { apiRequest } from './http';

export function listDiscounts(): Promise<Discount[]> {
  return apiRequest('/discounts');
}

/** The item tags a discount can apply to. */
export function listDiscountAppliesTo(): Promise<string[]> {
  return apiRequest('/discounts/applies-to');
}

export function createDiscount(input: DiscountInput): Promise<Discount> {
  return apiRequest('/discounts', { method: 'POST', json: input });
}

export function updateDiscount(id: number, input: DiscountInput): Promise<Discount> {
  return apiRequest(`/discounts/${id}`, { method: 'PATCH', json: input });
}

export function deleteDiscount(id: number): Promise<void> {
  return apiRequest(`/discounts/${id}`, { method: 'DELETE' });
}

export function bulkDeleteDiscounts(ids: number[]): Promise<{ deleted: number }> {
  return apiRequest('/discounts/bulk-delete', { method: 'POST', json: { ids } });
}
