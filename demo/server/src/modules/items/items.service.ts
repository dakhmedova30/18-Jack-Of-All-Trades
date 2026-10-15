import { HttpError } from '../../utils/httpError.js';
import { buildPage, toOffset, type Paginated } from '../../utils/pagination.js';
import type { ItemRepository } from './items.repository.js';
import type { CreateItemInput, ListItemsQuery, UpdateItemInput } from './items.schema.js';
import type { Item } from './items.types.js';

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

  return { listItems, getItem, createItem, updateItem, deleteItem, bulkDeleteItems };
}

export type ItemService = ReturnType<typeof createItemService>;
