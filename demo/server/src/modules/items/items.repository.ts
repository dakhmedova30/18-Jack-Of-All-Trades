import type { Queryable } from '../../db/database.js';
import type { CreateItemInput, ItemSortField, UpdateItemInput } from './items.schema.js';
import { toItem, type Item, type ItemRow } from './items.types.js';

/** Data access only: SQL lives here and nowhere else. Every query is scoped to one business. */

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
  async function findById(businessId: number, id: number): Promise<Item | undefined> {
    const { rows } = await db.query<ItemRow>(
      'SELECT * FROM items WHERE id = $1 AND business_id = $2',
      [id, businessId],
    );
    return rows[0] ? toItem(rows[0]) : undefined;
  }

  async function findPage(
    businessId: number,
    { search, limit, offset, sort = 'id', order = 'asc' }: ItemPageQuery,
  ) {
    const params: unknown[] = [businessId];
    let where = 'WHERE business_id = $1';
    if (search) {
      params.push(`%${escapeLikePattern(search)}%`);
      where += ` AND (name ILIKE $${params.length} OR array_to_string(tags, ' ') ILIKE $${params.length})`;
    }

    const countResult = await db.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM items ${where}`,
      params,
    );
    const limitIndex = params.length + 1;
    const { rows } = await db.query<ItemRow>(
      // id breaks ties, so rows with equal values keep a stable order across pages.
      `SELECT * FROM items ${where}
       ORDER BY ${ORDER_BY_FIELD[sort]} ${order === 'desc' ? 'DESC' : 'ASC'}, id ASC
       LIMIT $${limitIndex} OFFSET $${limitIndex + 1}`,
      [...params, limit, offset],
    );

    return { items: rows.map(toItem), total: countResult.rows[0]?.total ?? 0 };
  }

  async function insert(businessId: number, input: CreateItemInput): Promise<Item> {
    const { rows } = await db.query<ItemRow>(
      `INSERT INTO items (business_id, name, quantity, unit_price_cents, tags, note)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [businessId, input.name, input.quantity, input.unitPriceCents, input.tags, input.note],
    );
    return toItem(rows[0]!);
  }

  async function update(
    businessId: number,
    id: number,
    changes: UpdateItemInput,
  ): Promise<Item | undefined> {
    const assignments: string[] = [];
    const values: unknown[] = [];

    for (const field of Object.keys(COLUMN_BY_FIELD) as (keyof typeof COLUMN_BY_FIELD)[]) {
      const value = changes[field];
      if (value === undefined) continue;
      values.push(value);
      assignments.push(`${COLUMN_BY_FIELD[field]} = $${values.length}`);
    }

    if (assignments.length === 0) return findById(businessId, id);

    values.push(id, businessId);
    const { rows } = await db.query<ItemRow>(
      `UPDATE items SET ${assignments.join(', ')}, updated_at = now()
       WHERE id = $${values.length - 1} AND business_id = $${values.length}
       RETURNING *`,
      values,
    );
    return rows[0] ? toItem(rows[0]) : undefined;
  }

  async function remove(businessId: number, id: number): Promise<boolean> {
    const result = await db.query('DELETE FROM items WHERE id = $1 AND business_id = $2', [
      id,
      businessId,
    ]);
    return (result.rowCount ?? 0) > 0;
  }

  async function removeMany(businessId: number, ids: number[]): Promise<number> {
    const result = await db.query(
      'DELETE FROM items WHERE id = ANY($1::int[]) AND business_id = $2',
      [ids, businessId],
    );
    return result.rowCount ?? 0;
  }

  async function exists(businessId: number, id: number): Promise<boolean> {
    const { rowCount } = await db.query('SELECT 1 FROM items WHERE id = $1 AND business_id = $2', [
      id,
      businessId,
    ]);
    return (rowCount ?? 0) > 0;
  }

  /**
   * Adds `delta` (negative to decrement) to an item's stock. Callers that must
   * not go negative should check `findById` first for a clean error message;
   * the `quantity >= 0` column constraint is the backstop against races.
   */
  async function adjustQuantity(
    businessId: number,
    id: number,
    delta: number,
  ): Promise<Item | undefined> {
    const { rows } = await db.query<ItemRow>(
      `UPDATE items SET quantity = quantity + $1, updated_at = now()
       WHERE id = $2 AND business_id = $3 RETURNING *`,
      [delta, id, businessId],
    );
    return rows[0] ? toItem(rows[0]) : undefined;
  }

  /** How many of this business's items are at or below `threshold`, plus the `limit` lowest of them. */
  async function findLowStock(businessId: number, threshold: number, limit: number) {
    const countResult = await db.query<{ total: number }>(
      'SELECT COUNT(*)::int AS total FROM items WHERE business_id = $1 AND quantity <= $2',
      [businessId, threshold],
    );
    const { rows } = await db.query<{ id: number; name: string; quantity: number }>(
      `SELECT id, name, quantity FROM items
       WHERE business_id = $1 AND quantity <= $2
       ORDER BY quantity ASC, name ASC
       LIMIT $3`,
      [businessId, threshold, limit],
    );
    return { count: countResult.rows[0]?.total ?? 0, items: rows };
  }

  /** Total value of this business's stock at selling price, plus total units. */
  async function stockTotals(businessId: number): Promise<{ valueCents: number; units: number }> {
    const { rows } = await db.query<{ value_cents: string; units: string }>(
      `SELECT COALESCE(SUM(quantity::bigint * unit_price_cents), 0) AS value_cents,
              COALESCE(SUM(quantity), 0) AS units
       FROM items WHERE business_id = $1`,
      [businessId],
    );
    return { valueCents: Number(rows[0]!.value_cents), units: Number(rows[0]!.units) };
  }

  /**
   * The `limit` items with the most units sold in [from, to), most first, for
   * this business. Only lines still linked to an inventory item count: a
   * deleted item isn't in the inventory anymore, so it has no place here.
   */
  async function bestSellers(businessId: number, from: Date, to: Date, limit: number) {
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
       WHERE s.business_id = $1 AND s.sold_at >= $2 AND s.sold_at < $3
       GROUP BY i.id, i.name
       ORDER BY units_sold DESC, revenue_cents DESC, i.name ASC
       LIMIT $4`,
      [businessId, from.toISOString(), to.toISOString(), limit],
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
