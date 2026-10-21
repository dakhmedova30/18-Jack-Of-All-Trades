import type { Item, ItemInput, LowStock, Paginated } from '../types';
import { apiRequest } from './http';

export interface ListItemsParams {
  page: number;
  pageSize: number;
  search?: string;
}

export function listItems({ page, pageSize, search }: ListItemsParams): Promise<Paginated<Item>> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) query.set('search', search);
  return apiRequest(`/items?${query}`);
}

export function getLowStock(): Promise<LowStock> {
  return apiRequest('/items/low-stock');
}

export function createItem(input: ItemInput): Promise<Item> {
  return apiRequest('/items', { method: 'POST', json: input });
}

export function updateItem(id: number, changes: Partial<ItemInput>): Promise<Item> {
  return apiRequest(`/items/${id}`, { method: 'PATCH', json: changes });
}

export function deleteItem(id: number): Promise<void> {
  return apiRequest(`/items/${id}`, { method: 'DELETE' });
}

export function bulkDeleteItems(ids: number[]): Promise<{ deleted: number }> {
  return apiRequest('/items/bulk-delete', { method: 'POST', json: { ids } });
}
