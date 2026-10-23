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
 * Every call is scoped to one business.
 */
export function createSaleService(db: Db) {
  const reader = createSaleRepository(db);

  async function listSales(
    businessId: number,
    { page, pageSize, search, sort, order }: ListSalesQuery,
  ): Promise<Paginated<Sale>> {
    const { sales, total } = await reader.findPage(businessId, {
      search: search || undefined,
      sort,
      order,
      limit: pageSize,
      offset: toOffset(page, pageSize),
    });
    return buildPage(sales, page, pageSize, total);
  }

  async function getSale(businessId: number, id: number): Promise<Sale> {
    const sale = await reader.findById(businessId, id);
    if (!sale) throw HttpError.notFound('Sale', id);
    return sale;
  }

  /** Looks up each line's item and decrements its stock, snapshotting name/price. */
  async function sellLines(
    client: Queryable,
    businessId: number,
    lines: SaleLineInput[],
  ): Promise<NewSaleLineItem[]> {
    const items = createItemRepository(client);
    const result: NewSaleLineItem[] = [];
    for (const line of lines) {
      const item = await items.findById(businessId, line.itemId);
      if (!item) throw HttpError.badRequest(`Item ${line.itemId} does not exist`);
      if (item.quantity < line.quantity) {
        throw HttpError.badRequest(
          `Not enough stock for "${item.name}" (have ${item.quantity}, need ${line.quantity})`,
        );
      }
      await items.adjustQuantity(businessId, item.id, -line.quantity);
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

  /** Checks the channel belongs to this business, sells the lines, and fills in a blank description. */
  async function toSaleWrite(
    client: Queryable,
    businessId: number,
    input: CreateSaleInput,
  ): Promise<SaleWrite> {
    if (
      !(await createNamedListRepository(client, 'channels').findById(businessId, input.channelId))
    ) {
      throw HttpError.badRequest(`Channel ${input.channelId} does not exist`);
    }
    const items = await sellLines(client, businessId, input.items);
    return {
      soldAt: input.soldAt,
      channelId: input.channelId,
      description: input.description || describeLines(items),
      tags: input.tags,
      items,
    };
  }

  /** Puts a sale's line-item quantities back into stock (used on edit and delete). */
  async function restoreStock(client: Queryable, businessId: number, sale: Sale): Promise<void> {
    const items = createItemRepository(client);
    for (const line of sale.items) {
      if (line.itemId !== null) await items.adjustQuantity(businessId, line.itemId, line.quantity);
    }
  }

  function recordSale(businessId: number, input: CreateSaleInput): Promise<Sale> {
    return runInTransaction(db, async (client) => {
      const sales = createSaleRepository(client);
      return sales.insert(businessId, await toSaleWrite(client, businessId, input));
    });
  }

  function updateSale(businessId: number, id: number, input: UpdateSaleInput): Promise<Sale> {
    return runInTransaction(db, async (client) => {
      const sales = createSaleRepository(client);
      const existing = await sales.findById(businessId, id);
      if (!existing) throw HttpError.notFound('Sale', id);

      await restoreStock(client, businessId, existing);
      const updated = await sales.replace(
        businessId,
        id,
        await toSaleWrite(client, businessId, input),
      );
      return updated!;
    });
  }

  function deleteSale(businessId: number, id: number): Promise<void> {
    return runInTransaction(db, async (client) => {
      const sales = createSaleRepository(client);
      const existing = await sales.findById(businessId, id);
      if (!existing) throw HttpError.notFound('Sale', id);
      await restoreStock(client, businessId, existing);
      await sales.remove(businessId, id);
    });
  }

  function bulkDeleteSales(businessId: number, ids: number[]): Promise<{ deleted: number }> {
    return runInTransaction(db, async (client) => {
      const sales = createSaleRepository(client);
      let deleted = 0;
      for (const id of new Set(ids)) {
        const existing = await sales.findById(businessId, id);
        if (!existing) continue;
        await restoreStock(client, businessId, existing);
        if (await sales.remove(businessId, id)) deleted++;
      }
      return { deleted };
    });
  }

  /** "This month at a glance" for the Sales page: count, average and largest sale. */
  async function getMonthSummary(businessId: number, now = new Date()): Promise<SalesMonthSummary> {
    // UTC calendar month, matching Analytics and the Inventory best sellers.
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const { count, revenueCents, largest } = await reader.periodSummary(
      businessId,
      periodStart,
      periodEnd,
    );
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
