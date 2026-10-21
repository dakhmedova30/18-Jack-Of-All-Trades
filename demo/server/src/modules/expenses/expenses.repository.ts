import type { Queryable } from '../../db/database.js';
import type { ExpenseSortField } from './expenses.schema.js';

export interface ExpenseItem {
  id: number;
  itemId: number | null;
  itemName: string;
  quantity: number;
  unitCostCents: number;
  totalCents: number;
}

export interface Expense {
  id: number;
  incurredAt: string;
  tags: string[];
  /** Sum of the line items' totalCents. */
  totalCents: number;
  items: ExpenseItem[];
  createdAt: string;
  updatedAt: string;
}

/** A line item ready to insert: the item's name already looked up, if any. */
export interface NewExpenseLineItem {
  itemId: number | null;
  itemName: string;
  quantity: number;
  unitCostCents: number;
  totalCents: number;
}

export interface ExpenseWrite {
  incurredAt: string;
  tags: string[];
  items: NewExpenseLineItem[];
}

interface ExpenseRow {
  id: number;
  incurred_at: Date;
  tags: string[];
  created_at: Date;
  updated_at: Date;
}

interface ExpenseItemRow {
  id: number;
  expense_id: number;
  item_id: number | null;
  item_name: string;
  quantity: number;
  unit_cost_cents: number;
  total_cents: number;
}

function toExpenseItem(row: ExpenseItemRow): ExpenseItem {
  return {
    id: row.id,
    itemId: row.item_id,
    itemName: row.item_name,
    quantity: row.quantity,
    unitCostCents: row.unit_cost_cents,
    totalCents: row.total_cents,
  };
}

function assembleExpense(row: ExpenseRow, itemRows: ExpenseItemRow[]): Expense {
  const items = itemRows.map(toExpenseItem);
  return {
    id: row.id,
    incurredAt: row.incurred_at.toISOString(),
    tags: row.tags,
    totalCents: items.reduce((sum, item) => sum + item.totalCents, 0),
    items,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/** Makes %, _ and \ in user input match literally inside ILIKE. */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export interface ExpensePageQuery {
  search?: string;
  limit: number;
  offset: number;
  sort?: ExpenseSortField;
  order?: 'asc' | 'desc';
}

/** Whitelisted ORDER BY expressions; user input never reaches the SQL directly.
 *  An expense's total is the sum of its lines; tags sort by the first tag,
 *  case-insensitively. Same rules as the sales list. */
const ORDER_BY_FIELD = {
  id: 'id',
  incurredAt: 'incurred_at',
  total:
    '(SELECT COALESCE(SUM(ei.total_cents), 0) FROM expense_items ei WHERE ei.expense_id = expenses.id)',
  tags: 'lower(tags[1])',
} as const satisfies Record<ExpenseSortField, string>;

export function createExpenseRepository(db: Queryable) {
  async function itemRowsByExpenseId(expenseIds: number[]): Promise<Map<number, ExpenseItemRow[]>> {
    const byExpense = new Map<number, ExpenseItemRow[]>();
    if (expenseIds.length === 0) return byExpense;

    const { rows } = await db.query<ExpenseItemRow>(
      'SELECT * FROM expense_items WHERE expense_id = ANY($1::int[]) ORDER BY id ASC',
      [expenseIds],
    );
    for (const row of rows) {
      const list = byExpense.get(row.expense_id) ?? [];
      list.push(row);
      byExpense.set(row.expense_id, list);
    }
    return byExpense;
  }

  async function findById(id: number): Promise<Expense | undefined> {
    const { rows } = await db.query<ExpenseRow>('SELECT * FROM expenses WHERE id = $1', [id]);
    const row = rows[0];
    if (!row) return undefined;
    const itemRows = await itemRowsByExpenseId([id]);
    return assembleExpense(row, itemRows.get(id) ?? []);
  }

  async function findPage({
    search,
    limit,
    offset,
    sort = 'incurredAt',
    order = 'desc',
  }: ExpensePageQuery) {
    const filterParams: string[] = [];
    let where = '';
    if (search) {
      filterParams.push(`%${escapeLikePattern(search)}%`);
      where = `WHERE array_to_string(tags, ' ') ILIKE $1
        OR EXISTS (SELECT 1 FROM expense_items ei WHERE ei.expense_id = expenses.id AND ei.item_name ILIKE $1)`;
    }

    const countResult = await db.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM expenses ${where}`,
      filterParams,
    );
    const limitIndex = filterParams.length + 1;
    const { rows } = await db.query<ExpenseRow>(
      // Untagged expenses go last either way; id breaks ties so paging stays stable.
      `SELECT * FROM expenses ${where}
       ORDER BY ${ORDER_BY_FIELD[sort]} ${order === 'desc' ? 'DESC' : 'ASC'} NULLS LAST, id DESC
       LIMIT $${limitIndex} OFFSET $${limitIndex + 1}`,
      [...filterParams, limit, offset],
    );

    const itemRows = await itemRowsByExpenseId(rows.map((row) => row.id));
    return {
      expenses: rows.map((row) => assembleExpense(row, itemRows.get(row.id) ?? [])),
      total: countResult.rows[0]?.total ?? 0,
    };
  }

  async function insertItems(expenseId: number, items: NewExpenseLineItem[]): Promise<void> {
    for (const item of items) {
      await db.query(
        `INSERT INTO expense_items (expense_id, item_id, item_name, quantity, unit_cost_cents, total_cents)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [expenseId, item.itemId, item.itemName, item.quantity, item.unitCostCents, item.totalCents],
      );
    }
  }

  async function insert(input: ExpenseWrite): Promise<Expense> {
    const { rows } = await db.query<ExpenseRow>(
      `INSERT INTO expenses (incurred_at, tags) VALUES ($1, $2) RETURNING *`,
      [input.incurredAt, input.tags],
    );
    const row = rows[0]!;
    await insertItems(row.id, input.items);
    return (await findById(row.id))!;
  }

  /** Replaces an expense's header and its entire line-item list (not a partial patch). */
  async function replace(id: number, input: ExpenseWrite): Promise<Expense | undefined> {
    const { rows } = await db.query<ExpenseRow>(
      `UPDATE expenses SET incurred_at = $1, tags = $2, updated_at = now() WHERE id = $3 RETURNING *`,
      [input.incurredAt, input.tags, id],
    );
    if (!rows[0]) return undefined;

    await db.query('DELETE FROM expense_items WHERE expense_id = $1', [id]);
    await insertItems(id, input.items);
    return findById(id);
  }

  async function remove(id: number): Promise<boolean> {
    const result = await db.query('DELETE FROM expenses WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Spending in [from, to) split by line kind: lines linked to an inventory
   * item are restocks, free-text lines (rent, fees, ...) are running costs.
   */
  async function spendingByKind(from: Date, to: Date) {
    const { rows } = await db.query<{ restock_cents: string; running_cents: string }>(
      `SELECT COALESCE(SUM(ei.total_cents) FILTER (WHERE ei.item_id IS NOT NULL), 0) AS restock_cents,
              COALESCE(SUM(ei.total_cents) FILTER (WHERE ei.item_id IS NULL), 0) AS running_cents
       FROM expenses e
       JOIN expense_items ei ON ei.expense_id = e.id
       WHERE e.incurred_at >= $1 AND e.incurred_at < $2`,
      [from.toISOString(), to.toISOString()],
    );
    return {
      restockCents: Number(rows[0]!.restock_cents),
      runningCents: Number(rows[0]!.running_cents),
    };
  }

  /**
   * The `limit` inventory items with the most restock spending in [from, to),
   * most first. Only lines still linked to an item count (see spendingByKind).
   */
  async function topRestockItems(from: Date, to: Date, limit: number) {
    const { rows } = await db.query<{
      id: number;
      name: string;
      units: number;
      spent_cents: number;
    }>(
      `SELECT i.id, i.name,
              SUM(ei.quantity)::int AS units,
              SUM(ei.total_cents)::int AS spent_cents
       FROM expense_items ei
       JOIN expenses e ON e.id = ei.expense_id
       JOIN items i ON i.id = ei.item_id
       WHERE e.incurred_at >= $1 AND e.incurred_at < $2
       GROUP BY i.id, i.name
       ORDER BY spent_cents DESC, i.name ASC
       LIMIT $3`,
      [from.toISOString(), to.toISOString(), limit],
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      units: row.units,
      spentCents: row.spent_cents,
    }));
  }

  return { findById, findPage, insert, replace, remove, spendingByKind, topRestockItems };
}

export type ExpenseRepository = ReturnType<typeof createExpenseRepository>;
