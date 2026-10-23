import { HttpError } from '../../utils/httpError.js';
import { buildPage, toOffset, type Paginated } from '../../utils/pagination.js';
import type { ItemRepository } from './items.repository.js';
import type { CreateItemInput, ListItemsQuery, UpdateItemInput } from './items.schema.js';
import type { Item } from './items.types.js';

/** An item counts as "low stock" at or below this quantity. A fixed rule for
 *  now; a per-item reorder level would replace it if the schema gains one. */
export const LOW_STOCK_THRESHOLD = 5;

export interface LowStockSummary {
  count: number;
  threshold: number;
  /** Up to the requested limit (5 by default), lowest quantity first. */
  items: { id: number; name: string; quantity: number }[];
}

const BEST_SELLERS_LIMIT = 3;

export interface InventoryInsights {
  /** Quantity x unit (selling) price, summed over every item. */
  stockValueCents: number;
  totalUnits: number;
  /** Calendar month (UTC) the best sellers cover: [start, end). */
  periodStart: string;
  periodEnd: string;
  /** Top items by units sold this month, most first. */
  bestSellers: { id: number; name: string; unitsSold: number; revenueCents: number }[];
}

/** Business rules for inventory. No HTTP or SQL details in here. Every call is scoped to one business. */
export function createItemService(repository: ItemRepository) {
  async function listItems(
    businessId: number,
    { page, pageSize, search, sort, order }: ListItemsQuery,
  ): Promise<Paginated<Item>> {
    const { items, total } = await repository.findPage(businessId, {
      search: search || undefined,
      sort,
      order,
      limit: pageSize,
      offset: toOffset(page, pageSize),
    });
    return buildPage(items, page, pageSize, total);
  }

  async function getItem(businessId: number, id: number): Promise<Item> {
    const item = await repository.findById(businessId, id);
    if (!item) throw HttpError.notFound('Item', id);
    return item;
  }

  function createItem(businessId: number, input: CreateItemInput): Promise<Item> {
    return repository.insert(businessId, input);
  }

  async function updateItem(
    businessId: number,
    id: number,
    changes: UpdateItemInput,
  ): Promise<Item> {
    const item = await repository.update(businessId, id, changes);
    if (!item) throw HttpError.notFound('Item', id);
    return item;
  }

  async function deleteItem(businessId: number, id: number): Promise<void> {
    if (!(await repository.remove(businessId, id))) throw HttpError.notFound('Item', id);
  }

  async function bulkDeleteItems(businessId: number, ids: number[]): Promise<{ deleted: number }> {
    return { deleted: await repository.removeMany(businessId, [...new Set(ids)]) };
  }

  /** `limit` defaults to 5 for the home page tile; the Inventory page asks for more. */
  async function getLowStock(businessId: number, limit = 5): Promise<LowStockSummary> {
    const { count, items } = await repository.findLowStock(businessId, LOW_STOCK_THRESHOLD, limit);
    return { count, threshold: LOW_STOCK_THRESHOLD, items };
  }

  /** Stock value and this month's best sellers, for the Inventory page. */
  async function getInsights(businessId: number, now = new Date()): Promise<InventoryInsights> {
    // UTC calendar month, matching how Analytics buckets dates.
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const [totals, bestSellers] = await Promise.all([
      repository.stockTotals(businessId),
      repository.bestSellers(businessId, periodStart, periodEnd, BEST_SELLERS_LIMIT),
    ]);
    return {
      stockValueCents: totals.valueCents,
      totalUnits: totals.units,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      bestSellers,
    };
  }

  return {
    listItems,
    getItem,
    createItem,
    updateItem,
    deleteItem,
    bulkDeleteItems,
    getLowStock,
    getInsights,
  };
}

export type ItemService = ReturnType<typeof createItemService>;
