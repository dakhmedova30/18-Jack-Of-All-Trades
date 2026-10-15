import type { Queryable } from '../../db/database.js';

export interface SaleItem {
  id: number;
  itemId: number | null;
  itemName: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface Sale {
  id: number;
  soldAt: string;
  tags: string[];
  /** Sum of the line items' totalCents. */
  totalCents: number;
  items: SaleItem[];
  createdAt: string;
  updatedAt: string;
}

/** A line item ready to insert: the item's name and price already looked up. */
export interface NewSaleLineItem {
  itemId: number;
  itemName: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface SaleWrite {
  soldAt: string;
  tags: string[];
  items: NewSaleLineItem[];
}

interface SaleRow {
  id: number;
  sold_at: Date;
  tags: string[];
  created_at: Date;
  updated_at: Date;
}

interface SaleItemRow {
  id: number;
  sale_id: number;
  item_id: number | null;
  item_name: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
}

function toSaleItem(row: SaleItemRow): SaleItem {
  return {
    id: row.id,
    itemId: row.item_id,
    itemName: row.item_name,
    quantity: row.quantity,
    unitPriceCents: row.unit_price_cents,
    totalCents: row.total_cents,
  };
}

function assembleSale(row: SaleRow, itemRows: SaleItemRow[]): Sale {
  const items = itemRows.map(toSaleItem);
  return {
    id: row.id,
    soldAt: row.sold_at.toISOString(),
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

export interface SalePageQuery {
  search?: string;
  limit: number;
  offset: number;
}

export function createSaleRepository(db: Queryable) {
  async function itemRowsBySaleId(saleIds: number[]): Promise<Map<number, SaleItemRow[]>> {
    const bySale = new Map<number, SaleItemRow[]>();
    if (saleIds.length === 0) return bySale;

    const { rows } = await db.query<SaleItemRow>(
      'SELECT * FROM sale_items WHERE sale_id = ANY($1::int[]) ORDER BY id ASC',
      [saleIds],
    );
    for (const row of rows) {
      const list = bySale.get(row.sale_id) ?? [];
      list.push(row);
      bySale.set(row.sale_id, list);
    }
    return bySale;
  }

  async function findById(id: number): Promise<Sale | undefined> {
    const { rows } = await db.query<SaleRow>('SELECT * FROM sales WHERE id = $1', [id]);
    const row = rows[0];
    if (!row) return undefined;
    const itemRows = await itemRowsBySaleId([id]);
    return assembleSale(row, itemRows.get(id) ?? []);
  }

  async function findPage({ search, limit, offset }: SalePageQuery) {
    const filterParams: string[] = [];
    let where = '';
    if (search) {
      filterParams.push(`%${escapeLikePattern(search)}%`);
      where = `WHERE array_to_string(tags, ' ') ILIKE $1
        OR EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = sales.id AND si.item_name ILIKE $1)`;
    }

    const countResult = await db.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM sales ${where}`,
      filterParams,
    );
    const limitIndex = filterParams.length + 1;
    const { rows } = await db.query<SaleRow>(
      `SELECT * FROM sales ${where}
       ORDER BY sold_at DESC, id DESC LIMIT $${limitIndex} OFFSET $${limitIndex + 1}`,
      [...filterParams, limit, offset],
    );

    const itemRows = await itemRowsBySaleId(rows.map((row) => row.id));
    return {
      sales: rows.map((row) => assembleSale(row, itemRows.get(row.id) ?? [])),
      total: countResult.rows[0]?.total ?? 0,
    };
  }

  async function insertItems(saleId: number, items: NewSaleLineItem[]): Promise<void> {
    for (const item of items) {
      await db.query(
        `INSERT INTO sale_items (sale_id, item_id, item_name, quantity, unit_price_cents, total_cents)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [saleId, item.itemId, item.itemName, item.quantity, item.unitPriceCents, item.totalCents],
      );
    }
  }

  async function insert(input: SaleWrite): Promise<Sale> {
    const { rows } = await db.query<SaleRow>(
      `INSERT INTO sales (sold_at, tags) VALUES ($1, $2) RETURNING *`,
      [input.soldAt, input.tags],
    );
    const row = rows[0]!;
    await insertItems(row.id, input.items);
    return (await findById(row.id))!;
  }

  /** Replaces a sale's header and its entire line-item list (not a partial patch). */
  async function replace(id: number, input: SaleWrite): Promise<Sale | undefined> {
    const { rows } = await db.query<SaleRow>(
      `UPDATE sales SET sold_at = $1, tags = $2, updated_at = now() WHERE id = $3 RETURNING *`,
      [input.soldAt, input.tags, id],
    );
    if (!rows[0]) return undefined;

    await db.query('DELETE FROM sale_items WHERE sale_id = $1', [id]);
    await insertItems(id, input.items);
    return findById(id);
  }

  async function remove(id: number): Promise<boolean> {
    const result = await db.query('DELETE FROM sales WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  return { findById, findPage, insert, replace, remove };
}

export type SaleRepository = ReturnType<typeof createSaleRepository>;
