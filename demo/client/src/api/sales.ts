import type { Paginated, Sale, SaleInput } from '../types';
import { apiRequest } from './http';

export interface ListSalesParams {
  page: number;
  pageSize: number;
  search?: string;
}

export function listSales({ page, pageSize, search }: ListSalesParams): Promise<Paginated<Sale>> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) query.set('search', search);
  return apiRequest(`/sales?${query}`);
}

export function createSale(input: SaleInput): Promise<Sale> {
  return apiRequest('/sales', { method: 'POST', json: input });
}

export function updateSale(id: number, input: SaleInput): Promise<Sale> {
  return apiRequest(`/sales/${id}`, { method: 'PATCH', json: input });
}

export function deleteSale(id: number): Promise<void> {
  return apiRequest(`/sales/${id}`, { method: 'DELETE' });
}

export function bulkDeleteSales(ids: number[]): Promise<{ deleted: number }> {
  return apiRequest('/sales/bulk-delete', { method: 'POST', json: { ids } });
}
