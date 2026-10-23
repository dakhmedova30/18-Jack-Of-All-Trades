import { runInTransaction, type Db, type Queryable } from '../../db/database.js';
import { describeLines } from '../../utils/describeLines.js';
import { HttpError } from '../../utils/httpError.js';
import { buildPage, toOffset, type Paginated } from '../../utils/pagination.js';
import { createItemRepository } from '../items/items.repository.js';
import {
  createExpenseRepository,
  type Expense,
  type NewExpenseLineItem,
} from './expenses.repository.js';
import type {
  CreateExpenseInput,
  ListExpensesQuery,
  UpdateExpenseInput,
} from './expenses.schema.js';

interface ExpenseLineInput {
  itemId: number | null;
  description: string;
  quantity: number;
  unitCostCents: number;
}

/**
 * Business rules for expenses. A line that names an inventory item restocks it
 * (adds quantity back to stock) when the expense is recorded, and the restock is
 * undone (stock taken back out) on edit or delete — the mirror image of how
 * sales.service decrements stock. Every write runs inside one transaction so the
 * expense rows and the item's stock change together. Every call is scoped to one business.
 */
export interface ExpenseMonthBreakdown {
  /** Calendar month (UTC) covered: [start, end). */
  periodStart: string;
  periodEnd: string;
  /** Lines linked to an inventory item. */
  restockCents: number;
  /** Free-text lines: rent, fees, supplies and so on. */
  runningCents: number;
  totalCents: number;
  /** Top items by restock spending this month, most first (up to 5). */
  topRestockItems: { id: number; name: string; units: number; spentCents: number }[];
}

const TOP_RESTOCK_ITEMS_LIMIT = 5;

export function createExpenseService(db: Db) {
  const reader = createExpenseRepository(db);

  async function listExpenses(
    businessId: number,
    { page, pageSize, search, sort, order }: ListExpensesQuery,
  ): Promise<Paginated<Expense>> {
    const { expenses, total } = await reader.findPage(businessId, {
      search: search || undefined,
      sort,
      order,
      limit: pageSize,
      offset: toOffset(page, pageSize),
    });
    return buildPage(expenses, page, pageSize, total);
  }

  async function getExpense(businessId: number, id: number): Promise<Expense> {
    const expense = await reader.findById(businessId, id);
    if (!expense) throw HttpError.notFound('Expense', id);
    return expense;
  }

  /** Looks up each item-linked line and restocks it; free-text lines pass through. */
  async function applyLines(
    client: Queryable,
    businessId: number,
    lines: ExpenseLineInput[],
  ): Promise<NewExpenseLineItem[]> {
    const items = createItemRepository(client);
    const result: NewExpenseLineItem[] = [];
    for (const line of lines) {
      if (line.itemId === null) {
        result.push({
          itemId: null,
          itemName: line.description,
          quantity: line.quantity,
          unitCostCents: line.unitCostCents,
          totalCents: line.unitCostCents * line.quantity,
        });
        continue;
      }

      const item = await items.findById(businessId, line.itemId);
      if (!item) throw HttpError.badRequest(`Item ${line.itemId} does not exist`);
      await items.adjustQuantity(businessId, item.id, line.quantity);
      result.push({
        itemId: item.id,
        itemName: item.name,
        quantity: line.quantity,
        unitCostCents: line.unitCostCents,
        totalCents: line.unitCostCents * line.quantity,
      });
    }
    return result;
  }

  /** Reverses an expense's restocks (used before editing or deleting it). */
  async function undoLines(client: Queryable, businessId: number, expense: Expense): Promise<void> {
    const items = createItemRepository(client);
    for (const line of expense.items) {
      if (line.itemId === null) continue;
      const item = await items.findById(businessId, line.itemId);
      if (!item) continue; // item was deleted since; nothing to undo
      if (item.quantity < line.quantity) {
        throw HttpError.badRequest(
          `Can't undo the restock of "${item.name}": only ${item.quantity} in stock, ` +
            `need to remove ${line.quantity} (some may have already been sold)`,
        );
      }
      await items.adjustQuantity(businessId, item.id, -line.quantity);
    }
  }

  function recordExpense(businessId: number, input: CreateExpenseInput): Promise<Expense> {
    return runInTransaction(db, async (client) => {
      const expenses = createExpenseRepository(client);
      const items = await applyLines(client, businessId, input.items);
      return expenses.insert(businessId, {
        incurredAt: input.incurredAt,
        description: input.description || describeLines(items),
        tags: input.tags,
        items,
      });
    });
  }

  function updateExpense(
    businessId: number,
    id: number,
    input: UpdateExpenseInput,
  ): Promise<Expense> {
    return runInTransaction(db, async (client) => {
      const expenses = createExpenseRepository(client);
      const existing = await expenses.findById(businessId, id);
      if (!existing) throw HttpError.notFound('Expense', id);

      await undoLines(client, businessId, existing);
      const items = await applyLines(client, businessId, input.items);
      const updated = await expenses.replace(businessId, id, {
        incurredAt: input.incurredAt,
        description: input.description || describeLines(items),
        tags: input.tags,
        items,
      });
      return updated!;
    });
  }

  function deleteExpense(businessId: number, id: number): Promise<void> {
    return runInTransaction(db, async (client) => {
      const expenses = createExpenseRepository(client);
      const existing = await expenses.findById(businessId, id);
      if (!existing) throw HttpError.notFound('Expense', id);
      await undoLines(client, businessId, existing);
      await expenses.remove(businessId, id);
    });
  }

  function bulkDeleteExpenses(businessId: number, ids: number[]): Promise<{ deleted: number }> {
    return runInTransaction(db, async (client) => {
      const expenses = createExpenseRepository(client);
      let deleted = 0;
      for (const id of new Set(ids)) {
        const existing = await expenses.findById(businessId, id);
        if (!existing) continue;
        await undoLines(client, businessId, existing);
        if (await expenses.remove(businessId, id)) deleted++;
      }
      return { deleted };
    });
  }

  /**
   * "Where the money goes" for the Expenses page: this calendar month's (UTC)
   * spending split into restocks vs running costs. A restock line whose item
   * was later deleted loses its item link, so it counts as a running cost.
   */
  async function getMonthBreakdown(
    businessId: number,
    now = new Date(),
  ): Promise<ExpenseMonthBreakdown> {
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const [{ restockCents, runningCents }, topRestockItems] = await Promise.all([
      reader.spendingByKind(businessId, periodStart, periodEnd),
      reader.topRestockItems(businessId, periodStart, periodEnd, TOP_RESTOCK_ITEMS_LIMIT),
    ]);
    return {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      restockCents,
      runningCents,
      totalCents: restockCents + runningCents,
      topRestockItems,
    };
  }

  return {
    listExpenses,
    getExpense,
    recordExpense,
    updateExpense,
    deleteExpense,
    bulkDeleteExpenses,
    getMonthBreakdown,
  };
}

export type ExpenseService = ReturnType<typeof createExpenseService>;
