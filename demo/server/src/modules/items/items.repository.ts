import type { Queryable } from '../../db/database.js';
import type { CreateItemInput, UpdateItemInput } from './items.schema.js';
import { toItem, type Item, type ItemRow } from './items.types.js';

/** Data access only: SQL lives here and nowhere else. */

export interface ItemPageQuery {
  search?: string;
  limit: number;
  offset: number;
}

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

  async function findPage({ search, limit, offset }: ItemPageQuery) {
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
      `SELECT * FROM items ${where} ORDER BY id ASC LIMIT $${limitIndex} OFFSET $${limitIndex + 1}`,
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

  return { findById, findPage, insert, update, remove, removeMany, exists, adjustQuantity };
}

export type ItemRepository = ReturnType<typeof createItemRepository>;
