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
}

export function listSales({
  page,
  pageSize,
  search,
  sort,
  order,
}: ListSalesParams): Promise<Paginated<Sale>> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) query.set('search', search);
  if (sort) query.set('sort', sort);
  if (order) query.set('order', order);
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
