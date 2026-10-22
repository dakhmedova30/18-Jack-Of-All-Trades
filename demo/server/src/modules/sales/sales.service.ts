import { runInTransaction, type Db, type Queryable } from '../../db/database.js';
import { describeLines } from '../../utils/describeLines.js';
import { HttpError } from '../../utils/httpError.js';
import { buildPage, toOffset, type Paginated } from '../../utils/pagination.js';
import { createItemRepository } from '../items/items.repository.js';
import { createNamedListRepository } from '../namedLists/namedLists.repository.js';
import {
  createSaleRepository,
  type NewSaleLineItem,
  type Sale,
  type SaleWrite,
} from './sales.repository.js';
import type { CreateSaleInput, ListSalesQuery, UpdateSaleInput } from './sales.schema.js';

export interface SalesMonthSummary {
  /** Calendar month (UTC) covered: [start, end). */
  periodStart: string;
  periodEnd: string;
  saleCount: number;
  revenueCents: number;
  /** Revenue / number of sales, rounded to the cent; 0 with no sales. */
  averageSaleCents: number;
  largestSale: { id: number; soldAt: string; totalCents: number } | null;
}

interface SaleLineInput {
  itemId: number;
  quantity: number;
}

/**
 * Business rules for bookkeeping. Recording, editing or deleting a sale keeps
 * inventory stock in sync, so every write runs inside one database transaction
 * (sale rows + item rows together) via runInTransaction from db/database.ts.
 */
export function createSaleService(db: Db) {
  const reader = createSaleRepository(db);

  async function listSales({
    page,
    pageSize,
    search,
    sort,
    order,
  }: ListSalesQuery): Promise<Paginated<Sale>> {
    const { sales, total } = await reader.findPage({
      search: search || undefined,
      sort,
      order,
      limit: pageSize,
      offset: toOffset(page, pageSize),
    });
    return buildPage(sales, page, pageSize, total);
  }

  async function getSale(id: number): Promise<Sale> {
    const sale = await reader.findById(id);
    if (!sale) throw HttpError.notFound('Sale', id);
    return sale;
  }

  /** Looks up each line's item and decrements its stock, snapshotting name/price. */
  async function sellLines(client: Queryable, lines: SaleLineInput[]): Promise<NewSaleLineItem[]> {
    const items = createItemRepository(client);
    const result: NewSaleLineItem[] = [];
    for (const line of lines) {
      const item = await items.findById(line.itemId);
      if (!item) throw HttpError.badRequest(`Item ${line.itemId} does not exist`);
      if (item.quantity < line.quantity) {
        throw HttpError.badRequest(
          `Not enough stock for "${item.name}" (have ${item.quantity}, need ${line.quantity})`,
        );
      }
      await items.adjustQuantity(item.id, -line.quantity);
      result.push({
        itemId: item.id,
        itemName: item.name,
        quantity: line.quantity,
        unitPriceCents: item.unitPriceCents,
        totalCents: item.unitPriceCents * line.quantity,
      });
    }
    return result;
  }

  /** Checks the channel, sells the lines, and fills in a blank description. */
  async function toSaleWrite(client: Queryable, input: CreateSaleInput): Promise<SaleWrite> {
    if (!(await createNamedListRepository(client, 'channels').findById(input.channelId))) {
      throw HttpError.badRequest(`Channel ${input.channelId} does not exist`);
    }
    const items = await sellLines(client, input.items);
    return {
      soldAt: input.soldAt,
      channelId: input.channelId,
      description: input.description || describeLines(items),
      tags: input.tags,
      items,
    };
  }

  /** Puts a sale's line-item quantities back into stock (used on edit and delete). */
  async function restoreStock(client: Queryable, sale: Sale): Promise<void> {
    const items = createItemRepository(client);
    for (const line of sale.items) {
      if (line.itemId !== null) await items.adjustQuantity(line.itemId, line.quantity);
    }
  }

  function recordSale(input: CreateSaleInput): Promise<Sale> {
    return runInTransaction(db, async (client) => {
      const sales = createSaleRepository(client);
      return sales.insert(await toSaleWrite(client, input));
    });
  }

  function updateSale(id: number, input: UpdateSaleInput): Promise<Sale> {
    return runInTransaction(db, async (client) => {
      const sales = createSaleRepository(client);
      const existing = await sales.findById(id);
      if (!existing) throw HttpError.notFound('Sale', id);

      await restoreStock(client, existing);
      const updated = await sales.replace(id, await toSaleWrite(client, input));
      return updated!;
    });
  }

  function deleteSale(id: number): Promise<void> {
    return runInTransaction(db, async (client) => {
      const sales = createSaleRepository(client);
      const existing = await sales.findById(id);
      if (!existing) throw HttpError.notFound('Sale', id);
      await restoreStock(client, existing);
      await sales.remove(id);
    });
  }

  function bulkDeleteSales(ids: number[]): Promise<{ deleted: number }> {
    return runInTransaction(db, async (client) => {
      const sales = createSaleRepository(client);
      let deleted = 0;
      for (const id of new Set(ids)) {
        const existing = await sales.findById(id);
        if (!existing) continue;
        await restoreStock(client, existing);
        if (await sales.remove(id)) deleted++;
      }
      return { deleted };
    });
  }

  /** "This month at a glance" for the Sales page: count, average and largest sale. */
  async function getMonthSummary(now = new Date()): Promise<SalesMonthSummary> {
    // UTC calendar month, matching Analytics and the Inventory best sellers.
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const { count, revenueCents, largest } = await reader.periodSummary(periodStart, periodEnd);
    return {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      saleCount: count,
      revenueCents,
      averageSaleCents: count > 0 ? Math.round(revenueCents / count) : 0,
      largestSale: largest,
    };
  }

  return {
    listSales,
    getSale,
    recordSale,
    updateSale,
    deleteSale,
    bulkDeleteSales,
    getMonthSummary,
  };
}

export type SaleService = ReturnType<typeof createSaleService>;
