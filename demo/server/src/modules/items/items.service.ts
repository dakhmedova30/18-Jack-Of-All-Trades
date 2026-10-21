import { HttpError } from '../../utils/httpError.js';
import { buildPage, toOffset, type Paginated } from '../../utils/pagination.js';
import type { ItemRepository } from './items.repository.js';
import type { CreateItemInput, ListItemsQuery, UpdateItemInput } from './items.schema.js';
import type { Item } from './items.types.js';

/** An item counts as "low stock" at or below this quantity. A fixed rule for
 *  now; a per-item reorder level would replace it if the schema gains one. */
export const LOW_STOCK_THRESHOLD = 5;
/** How many of the lowest-stock items to name in the home page warning. */
const LOW_STOCK_PREVIEW_LIMIT = 5;

export interface LowStockSummary {
  count: number;
  threshold: number;
  /** Up to LOW_STOCK_PREVIEW_LIMIT items, lowest quantity first. */
  items: { id: number; name: string; quantity: number }[];
}

/** Business rules for inventory. No HTTP or SQL details in here. */
export function createItemService(repository: ItemRepository) {
  async function listItems({ page, pageSize, search }: ListItemsQuery): Promise<Paginated<Item>> {
    const { items, total } = await repository.findPage({
      search: search || undefined,
      limit: pageSize,
      offset: toOffset(page, pageSize),
    });
    return buildPage(items, page, pageSize, total);
  }

  async function getItem(id: number): Promise<Item> {
    const item = await repository.findById(id);
    if (!item) throw HttpError.notFound('Item', id);
    return item;
  }

  function createItem(input: CreateItemInput): Promise<Item> {
    return repository.insert(input);
  }

  async function updateItem(id: number, changes: UpdateItemInput): Promise<Item> {
    const item = await repository.update(id, changes);
    if (!item) throw HttpError.notFound('Item', id);
    return item;
  }

  async function deleteItem(id: number): Promise<void> {
    if (!(await repository.remove(id))) throw HttpError.notFound('Item', id);
  }

  async function bulkDeleteItems(ids: number[]): Promise<{ deleted: number }> {
    return { deleted: await repository.removeMany([...new Set(ids)]) };
  }

  async function getLowStock(): Promise<LowStockSummary> {
    const { count, items } = await repository.findLowStock(
      LOW_STOCK_THRESHOLD,
      LOW_STOCK_PREVIEW_LIMIT,
    );
    return { count, threshold: LOW_STOCK_THRESHOLD, items };
  }

  return {
    listItems,
    getItem,
    createItem,
    updateItem,
    deleteItem,
    bulkDeleteItems,
    getLowStock,
  };
}

export type ItemService = ReturnType<typeof createItemService>;
