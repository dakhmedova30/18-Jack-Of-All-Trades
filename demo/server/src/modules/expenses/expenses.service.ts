import { runInTransaction, type Db, type Queryable } from '../../db/database.js';
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
 * expense rows and the item's stock change together.
 */
export function createExpenseService(db: Db) {
  const reader = createExpenseRepository(db);

  async function listExpenses({
    page,
    pageSize,
    search,
  }: ListExpensesQuery): Promise<Paginated<Expense>> {
    const { expenses, total } = await reader.findPage({
      search: search || undefined,
      limit: pageSize,
      offset: toOffset(page, pageSize),
    });
    return buildPage(expenses, page, pageSize, total);
  }

  async function getExpense(id: number): Promise<Expense> {
    const expense = await reader.findById(id);
    if (!expense) throw HttpError.notFound('Expense', id);
    return expense;
  }

  /** Looks up each item-linked line and restocks it; free-text lines pass through. */
  async function applyLines(
    client: Queryable,
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

      const item = await items.findById(line.itemId);
      if (!item) throw HttpError.badRequest(`Item ${line.itemId} does not exist`);
      await items.adjustQuantity(item.id, line.quantity);
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
  async function undoLines(client: Queryable, expense: Expense): Promise<void> {
    const items = createItemRepository(client);
    for (const line of expense.items) {
      if (line.itemId === null) continue;
      const item = await items.findById(line.itemId);
      if (!item) continue; // item was deleted since; nothing to undo
      if (item.quantity < line.quantity) {
        throw HttpError.badRequest(
          `Can't undo the restock of "${item.name}": only ${item.quantity} in stock, ` +
            `need to remove ${line.quantity} (some may have already been sold)`,
        );
      }
      await items.adjustQuantity(item.id, -line.quantity);
    }
  }

  function recordExpense(input: CreateExpenseInput): Promise<Expense> {
    return runInTransaction(db, async (client) => {
      const expenses = createExpenseRepository(client);
      const items = await applyLines(client, input.items);
      return expenses.insert({ incurredAt: input.incurredAt, tags: input.tags, items });
    });
  }

  function updateExpense(id: number, input: UpdateExpenseInput): Promise<Expense> {
    return runInTransaction(db, async (client) => {
      const expenses = createExpenseRepository(client);
      const existing = await expenses.findById(id);
      if (!existing) throw HttpError.notFound('Expense', id);

      await undoLines(client, existing);
      const items = await applyLines(client, input.items);
      const updated = await expenses.replace(id, {
        incurredAt: input.incurredAt,
        tags: input.tags,
        items,
      });
      return updated!;
    });
  }

  function deleteExpense(id: number): Promise<void> {
    return runInTransaction(db, async (client) => {
      const expenses = createExpenseRepository(client);
      const existing = await expenses.findById(id);
      if (!existing) throw HttpError.notFound('Expense', id);
      await undoLines(client, existing);
      await expenses.remove(id);
    });
  }

  function bulkDeleteExpenses(ids: number[]): Promise<{ deleted: number }> {
    return runInTransaction(db, async (client) => {
      const expenses = createExpenseRepository(client);
      let deleted = 0;
      for (const id of new Set(ids)) {
        const existing = await expenses.findById(id);
        if (!existing) continue;
        await undoLines(client, existing);
        if (await expenses.remove(id)) deleted++;
      }
      return { deleted };
    });
  }

  return {
    listExpenses,
    getExpense,
    recordExpense,
    updateExpense,
    deleteExpense,
    bulkDeleteExpenses,
  };
}

export type ExpenseService = ReturnType<typeof createExpenseService>;
