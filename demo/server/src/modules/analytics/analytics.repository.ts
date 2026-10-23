import type { Queryable } from '../../db/database.js';

export interface TaggedLine {
  /** ISO timestamp of the parent sale/expense. */
  at: string;
  /** The parent record's first tag, or 'Untagged' if it has none. A record
   *  contributes to exactly one tag bucket (never split across its tags), so
   *  bucket totals always sum to the grand total. */
  tag: string;
  totalCents: number;
}

/**
 * Read-only aggregation queries over sales, expenses and items, scoped to one
 * business. No writes here; this module only reports on data the other
 * modules already own. Returns raw tagged lines rather than pre-grouping by
 * date in SQL — bucketing by month/day and folding tags into "top N + Other"
 * are business/presentation rules, so that happens in the service, not here.
 */
export function createAnalyticsRepository(db: Queryable) {
  /** One row per sale line, dated and tagged, for this business's sales at or after `since`. */
  async function revenueLines(businessId: number, since: Date): Promise<TaggedLine[]> {
    const { rows } = await db.query<{ sold_at: Date; tag: string; total_cents: number }>(
      `SELECT s.sold_at, COALESCE(s.tags[1], 'Untagged') AS tag, si.total_cents
       FROM sales s
       JOIN sale_items si ON si.sale_id = s.id
       WHERE s.business_id = $1 AND s.sold_at >= $2`,
      [businessId, since.toISOString()],
    );
    return rows.map((row) => ({
      at: row.sold_at.toISOString(),
      tag: row.tag,
      totalCents: row.total_cents,
    }));
  }

  /** One row per expense line, dated and tagged, for this business's expenses at or after `since`. */
  async function expenseLines(businessId: number, since: Date): Promise<TaggedLine[]> {
    const { rows } = await db.query<{ incurred_at: Date; tag: string; total_cents: number }>(
      `SELECT e.incurred_at, COALESCE(e.tags[1], 'Untagged') AS tag, ei.total_cents
       FROM expenses e
       JOIN expense_items ei ON ei.expense_id = e.id
       WHERE e.business_id = $1 AND e.incurred_at >= $2`,
      [businessId, since.toISOString()],
    );
    return rows.map((row) => ({
      at: row.incurred_at.toISOString(),
      tag: row.tag,
      totalCents: row.total_cents,
    }));
  }

  /** Current stock grouped by each item's first tag ('Untagged' if none), largest first,
   *  for this business. A snapshot: items only store today's quantity, so there's no date filter. */
  async function stockByTag(
    businessId: number,
  ): Promise<{ tag: string; quantity: number; itemCount: number }[]> {
    const { rows } = await db.query<{ tag: string; quantity: number; item_count: number }>(
      `SELECT COALESCE(tags[1], 'Untagged') AS tag,
              SUM(quantity)::int AS quantity,
              COUNT(*)::int AS item_count
       FROM items
       WHERE business_id = $1
       GROUP BY 1
       ORDER BY quantity DESC, tag ASC`,
      [businessId],
    );
    return rows.map((row) => ({ tag: row.tag, quantity: row.quantity, itemCount: row.item_count }));
  }

  return { revenueLines, expenseLines, stockByTag };
}

export type AnalyticsRepository = ReturnType<typeof createAnalyticsRepository>;
