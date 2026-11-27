import type {
  InventoryInsights,
  Item,
  ItemInput,
  ItemSortField,
  ItemTagCount,
  ItemUpdateInput,
  LowStock,
  Paginated,
  SortOrder,
} from '../types';
import { apiRequest } from './http';

export interface ListItemsParams {
  page: number;
  pageSize: number;
  search?: string;
  /** Keeps items with any of these tags; empty or missing for all items. */
  tags?: string[];
  /** Server default: id ascending. */
  sort?: ItemSortField;
  order?: SortOrder;
}

export function listItems({
  page,
  pageSize,
  search,
  tags,
  sort,
  order,
}: ListItemsParams): Promise<Paginated<Item>> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) query.set('search', search);
  tags?.forEach((tag) => query.append('tag', tag));
  if (sort) query.set('sort', sort);
  if (order) query.set('order', order);
  return apiRequest(`/items?${query}`);
}

/** @param limit How many of the lowest items to list (server default 5, max 100). */
export function getLowStock(limit?: number): Promise<LowStock> {
  return apiRequest(`/items/low-stock${limit !== undefined ? `?limit=${limit}` : ''}`);
}

/** Stock value, this month's top 3 sellers and in-stock items with no sales this month. */
/** @param days The last this many days up to now; leave out for this calendar month. */
export function getInventoryInsights(days?: number): Promise<InventoryInsights> {
  return apiRequest(`/items/insights${days !== undefined ? `?days=${days}` : ''}`);
}

export function createItem(input: ItemInput): Promise<Item> {
  return apiRequest('/items', { method: 'POST', json: input });
}

export function updateItem(id: number, changes: ItemUpdateInput): Promise<Item> {
  return apiRequest(`/items/${id}`, { method: 'PATCH', json: changes });
}

export function deleteItem(id: number): Promise<void> {
  return apiRequest(`/items/${id}`, { method: 'DELETE' });
}

export function bulkDeleteItems(ids: number[]): Promise<{ deleted: number }> {
  return apiRequest('/items/bulk-delete', { method: 'POST', json: { ids } });
}

/** Shows the items on the public profile (true) or hides them (false); skips ids that aren't yours. */
export function bulkSetItemsPublic(ids: number[], isPublic: boolean): Promise<{ updated: number }> {
  return apiRequest('/items/bulk-visibility', { method: 'POST', json: { ids, isPublic } });
}

/** The tags in use on items, most used first. */
export function listItemTags(): Promise<ItemTagCount[]> {
  return apiRequest('/items/tags');
}

/** Renames the tag on every item that has it (merging into an existing tag if the name is taken). */
export function renameItemTag(name: string, newName: string): Promise<ItemTagCount> {
  return apiRequest(`/items/tags?name=${encodeURIComponent(name)}`, {
    method: 'PUT',
    json: { name: newName },
  });
}

/** Removes the tag from every item that has it; the items stay. */
export function deleteItemTag(name: string): Promise<void> {
  return apiRequest(`/items/tags?name=${encodeURIComponent(name)}`, { method: 'DELETE' });
}
