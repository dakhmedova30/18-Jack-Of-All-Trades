import type { Queryable } from '../../db/database.js';
import type { SaleSortField } from './sales.schema.js';

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
  /** null only for sales recorded before channels existed. */
  channel: { id: number; name: string } | null;
  description: string;
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
  channelId: number | null;
  description: string;
  tags: string[];
  items: NewSaleLineItem[];
}

interface SaleRow {
  id: number;
  sold_at: Date;
  channel_id: number | null;
  channel_name: string | null;
  description: string;
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
    channel: row.channel_id === null ? null : { id: row.channel_id, name: row.channel_name ?? '' },
    description: row.description,
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

/** Every sale query selects through this, so rows always carry the channel's name. */
const SELECT_SALES = `SELECT sales.*, channels.name AS channel_name
  FROM sales LEFT JOIN channels ON channels.id = sales.channel_id`;

export interface SalePageQuery {
  search?: string;
  limit: number;
  offset: number;
  sort?: SaleSortField;
  order?: 'asc' | 'desc';
}

/** Whitelisted ORDER BY expressions; user input never reaches the SQL directly.
 *  A sale's total is the sum of its lines; tags sort by the first tag and
 *  channels by name, both case-insensitively. Qualified with "sales." because
 *  the queries join channels, which also has an id. */
const ORDER_BY_FIELD = {
  id: 'sales.id',
  soldAt: 'sales.sold_at',
  total: '(SELECT COALESCE(SUM(si.total_cents), 0) FROM sale_items si WHERE si.sale_id = sales.id)',
  tags: 'lower(sales.tags[1])',
  channel: 'lower(channels.name)',
} as const satisfies Record<SaleSortField, string>;

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

  async function findById(businessId: number, id: number): Promise<Sale | undefined> {
    const { rows } = await db.query<SaleRow>(
      `${SELECT_SALES} WHERE sales.id = $1 AND sales.business_id = $2`,
      [id, businessId],
    );
    const row = rows[0];
    if (!row) return undefined;
    const itemRows = await itemRowsBySaleId([id]);
    return assembleSale(row, itemRows.get(id) ?? []);
  }

  async function findPage(
    businessId: number,
    { search, limit, offset, sort = 'soldAt', order = 'desc' }: SalePageQuery,
  ) {
    const params: unknown[] = [businessId];
    let where = 'WHERE sales.business_id = $1';
    if (search) {
      params.push(`%${escapeLikePattern(search)}%`);
      where += ` AND (array_to_string(sales.tags, ' ') ILIKE $${params.length}
        OR sales.description ILIKE $${params.length}
        OR channels.name ILIKE $${params.length}
        OR EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = sales.id AND si.item_name ILIKE $${params.length}))`;
    }

    const countResult = await db.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total
       FROM sales LEFT JOIN channels ON channels.id = sales.channel_id ${where}`,
      params,
    );
    const limitIndex = params.length + 1;
    const { rows } = await db.query<SaleRow>(
      // Untagged / channel-less sales go last either way; id breaks ties so paging stays stable.
      `${SELECT_SALES} ${where}
       ORDER BY ${ORDER_BY_FIELD[sort]} ${order === 'desc' ? 'DESC' : 'ASC'} NULLS LAST,
         sales.id DESC
       LIMIT $${limitIndex} OFFSET $${limitIndex + 1}`,
      [...params, limit, offset],
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

  async function insert(businessId: number, input: SaleWrite): Promise<Sale> {
    const { rows } = await db.query<{ id: number }>(
      `INSERT INTO sales (business_id, sold_at, channel_id, description, tags) VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [businessId, input.soldAt, input.channelId, input.description, input.tags],
    );
    const row = rows[0]!;
    await insertItems(row.id, input.items);
    return (await findById(businessId, row.id))!;
  }

  /** Replaces a sale's header and its entire line-item list (not a partial patch). */
  async function replace(
    businessId: number,
    id: number,
    input: SaleWrite,
  ): Promise<Sale | undefined> {
    const { rows } = await db.query<{ id: number }>(
      `UPDATE sales SET sold_at = $1, channel_id = $2, description = $3, tags = $4,
         updated_at = now()
       WHERE id = $5 AND business_id = $6 RETURNING id`,
      [input.soldAt, input.channelId, input.description, input.tags, id, businessId],
    );
    if (!rows[0]) return undefined;

    await db.query('DELETE FROM sale_items WHERE sale_id = $1', [id]);
    await insertItems(id, input.items);
    return findById(businessId, id);
  }

  async function remove(businessId: number, id: number): Promise<boolean> {
    const result = await db.query('DELETE FROM sales WHERE id = $1 AND business_id = $2', [
      id,
      businessId,
    ]);
    return (result.rowCount ?? 0) > 0;
  }

  /** Sale count, revenue and the single largest sale for this business's sales in [from, to). */
  async function periodSummary(businessId: number, from: Date, to: Date) {
    const params = [businessId, from.toISOString(), to.toISOString()];
    // One row per sale with its total (sum of lines), reused by both queries.
    const perSale = `
      SELECT s.id, s.sold_at, COALESCE(SUM(si.total_cents), 0)::int AS total_cents
      FROM sales s
      LEFT JOIN sale_items si ON si.sale_id = s.id
      WHERE s.business_id = $1 AND s.sold_at >= $2 AND s.sold_at < $3
      GROUP BY s.id`;
    const [totals, largest] = await Promise.all([
      db.query<{ count: number; revenue_cents: string }>(
        `SELECT COUNT(*)::int AS count, COALESCE(SUM(total_cents), 0) AS revenue_cents
         FROM (${perSale}) per_sale`,
        params,
      ),
      db.query<{ id: number; sold_at: Date; total_cents: number }>(
        `SELECT * FROM (${perSale}) per_sale ORDER BY total_cents DESC, sold_at DESC, id DESC LIMIT 1`,
        params,
      ),
    ]);
    const top = largest.rows[0];
    return {
      count: totals.rows[0]!.count,
      revenueCents: Number(totals.rows[0]!.revenue_cents),
      largest: top
        ? { id: top.id, soldAt: top.sold_at.toISOString(), totalCents: top.total_cents }
        : null,
    };
  }

  return { findById, findPage, insert, replace, remove, periodSummary };
}

export type SaleRepository = ReturnType<typeof createSaleRepository>;
