import type { Queryable } from '../../db/database.js';
import type { CreateItemInput, ItemSortField, UpdateItemInput } from './items.schema.js';
import { toItem, type Item, type ItemRow } from './items.types.js';

/** Data access only: SQL lives here and nowhere else. */

export interface ItemPageQuery {
  search?: string;
  limit: number;
  offset: number;
  sort?: ItemSortField;
  order?: 'asc' | 'desc';
}

/** Whitelisted ORDER BY expressions; user input never reaches the SQL directly.
 *  Names sort case-insensitively, so "apple" doesn't land after "Zebra". */
const ORDER_BY_FIELD = {
  id: 'id',
  name: 'lower(name)',
  quantity: 'quantity',
  unitPriceCents: 'unit_price_cents',
} as const satisfies Record<ItemSortField, string>;

const COLUMN_BY_FIELD = {
  name: 'name',
  quantity: 'quantity',
  unitPriceCents: 'unit_price_cents',
  tags: 'tags',
  note: 'note',
} as const satisfies Record<keyof UpdateItemInput, string>;

/** Makes %, _ and \ in user input match literally inside ILIKE. */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function createItemRepository(db: Queryable) {
  async function findById(id: number): Promise<Item | undefined> {
    const { rows } = await db.query<ItemRow>('SELECT * FROM items WHERE id = $1', [id]);
    return rows[0] ? toItem(rows[0]) : undefined;
  }

  async function findPage({ search, limit, offset, sort = 'id', order = 'asc' }: ItemPageQuery) {
    const filterParams: string[] = [];
    let where = '';
    if (search) {
      filterParams.push(`%${escapeLikePattern(search)}%`);
      where = `WHERE name ILIKE $1 OR array_to_string(tags, ' ') ILIKE $1`;
    }

    const countResult = await db.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM items ${where}`,
      filterParams,
    );
    const limitIndex = filterParams.length + 1;
    const { rows } = await db.query<ItemRow>(
      // id breaks ties, so rows with equal values keep a stable order across pages.
      `SELECT * FROM items ${where}
       ORDER BY ${ORDER_BY_FIELD[sort]} ${order === 'desc' ? 'DESC' : 'ASC'}, id ASC
       LIMIT $${limitIndex} OFFSET $${limitIndex + 1}`,
      [...filterParams, limit, offset],
    );

    return { items: rows.map(toItem), total: countResult.rows[0]?.total ?? 0 };
  }

  async function insert(input: CreateItemInput): Promise<Item> {
    const { rows } = await db.query<ItemRow>(
      `INSERT INTO items (name, quantity, unit_price_cents, tags, note)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [input.name, input.quantity, input.unitPriceCents, input.tags, input.note],
    );
    return toItem(rows[0]!);
  }

  async function update(id: number, changes: UpdateItemInput): Promise<Item | undefined> {
    const assignments: string[] = [];
    const values: unknown[] = [];

    for (const field of Object.keys(COLUMN_BY_FIELD) as (keyof typeof COLUMN_BY_FIELD)[]) {
      const value = changes[field];
      if (value === undefined) continue;
      values.push(value);
      assignments.push(`${COLUMN_BY_FIELD[field]} = $${values.length}`);
    }

    if (assignments.length === 0) return findById(id);

    values.push(id);
    const { rows } = await db.query<ItemRow>(
      `UPDATE items SET ${assignments.join(', ')}, updated_at = now()
       WHERE id = $${values.length}
       RETURNING *`,
      values,
    );
    return rows[0] ? toItem(rows[0]) : undefined;
  }

  async function remove(id: number): Promise<boolean> {
    const result = await db.query('DELETE FROM items WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async function removeMany(ids: number[]): Promise<number> {
    const result = await db.query('DELETE FROM items WHERE id = ANY($1::int[])', [ids]);
    return result.rowCount ?? 0;
  }

  async function exists(id: number): Promise<boolean> {
    const { rowCount } = await db.query('SELECT 1 FROM items WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }

  /**
   * Adds `delta` (negative to decrement) to an item's stock. Callers that must
   * not go negative should check `findById` first for a clean error message;
   * the `quantity >= 0` column constraint is the backstop against races.
   */
  async function adjustQuantity(id: number, delta: number): Promise<Item | undefined> {
    const { rows } = await db.query<ItemRow>(
      `UPDATE items SET quantity = quantity + $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [delta, id],
    );
    return rows[0] ? toItem(rows[0]) : undefined;
  }

  /** How many items are at or below `threshold`, plus the `limit` lowest of them (lowest first). */
  async function findLowStock(threshold: number, limit: number) {
    const countResult = await db.query<{ total: number }>(
      'SELECT COUNT(*)::int AS total FROM items WHERE quantity <= $1',
      [threshold],
    );
    const { rows } = await db.query<{ id: number; name: string; quantity: number }>(
      `SELECT id, name, quantity FROM items
       WHERE quantity <= $1
       ORDER BY quantity ASC, name ASC
       LIMIT $2`,
      [threshold, limit],
    );
    return { count: countResult.rows[0]?.total ?? 0, items: rows };
  }

  /** Total value of everything in stock at selling price, plus total units. */
  async function stockTotals(): Promise<{ valueCents: number; units: number }> {
    const { rows } = await db.query<{ value_cents: string; units: string }>(
      `SELECT COALESCE(SUM(quantity::bigint * unit_price_cents), 0) AS value_cents,
              COALESCE(SUM(quantity), 0) AS units
       FROM items`,
    );
    return { valueCents: Number(rows[0]!.value_cents), units: Number(rows[0]!.units) };
  }

  /**
   * The `limit` items with the most units sold in [from, to), most first.
   * Only lines still linked to an inventory item count: a deleted item isn't
   * in the inventory anymore, so it has no place in this list.
   */
  async function bestSellers(from: Date, to: Date, limit: number) {
    const { rows } = await db.query<{
      id: number;
      name: string;
      units_sold: number;
      revenue_cents: number;
    }>(
      `SELECT i.id, i.name,
              SUM(si.quantity)::int AS units_sold,
              SUM(si.total_cents)::int AS revenue_cents
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       JOIN items i ON i.id = si.item_id
       WHERE s.sold_at >= $1 AND s.sold_at < $2
       GROUP BY i.id, i.name
       ORDER BY units_sold DESC, revenue_cents DESC, i.name ASC
       LIMIT $3`,
      [from.toISOString(), to.toISOString(), limit],
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      unitsSold: row.units_sold,
      revenueCents: row.revenue_cents,
    }));
  }

  return {
    findById,
    findPage,
    insert,
    update,
    remove,
    removeMany,
    exists,
    adjustQuantity,
    findLowStock,
    stockTotals,
    bestSellers,
  };
}

export type ItemRepository = ReturnType<typeof createItemRepository>;
