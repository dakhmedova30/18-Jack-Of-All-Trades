import type {
  Paginated,
  Sale,
  SaleInput,
  SaleSortField,
  SalesMonthSummary,
  SortOrder,
} from '../types';
import { apiRequest } from './http';

export interface ListSalesParams {
  page: number;
  pageSize: number;
  search?: string;
  /** Server default: newest sale first. */
  sort?: SaleSortField;
  order?: SortOrder;
  channelId?: number;
  marketId?: number;
  /** "2026-10-01": sales from the start of this UTC day. */
  from?: string;
  /** "2026-10-31": sales up to the end of this UTC day. */
  to?: string;
}

export function listSales({
  page,
  pageSize,
  search,
  sort,
  order,
  channelId,
  marketId,
  from,
  to,
}: ListSalesParams): Promise<Paginated<Sale>> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) query.set('search', search);
  if (sort) query.set('sort', sort);
  if (order) query.set('order', order);
  if (channelId) query.set('channelId', String(channelId));
  if (marketId) query.set('marketId', String(marketId));
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  return apiRequest(`/sales?${query}`);
}

/** This month's sale count, average sale and largest sale. */
export function getSalesMonthSummary(): Promise<SalesMonthSummary> {
  return apiRequest('/sales/month-summary');
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
