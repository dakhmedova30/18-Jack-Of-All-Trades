import type { Db } from '../../db/database.js';
import { createAnalyticsRepository, type TaggedLine } from './analytics.repository.js';

export const OTHER_LABEL = 'Other';

export const ANALYTICS_RANGES = ['week', 'month', 'ytd', '12months'] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];
export const DEFAULT_ANALYTICS_RANGE: AnalyticsRange = '12months';

export interface TagSeries {
  label: string;
  values: number[];
}

export interface AnalyticsSummary {
  /** Sum of revenueSeries / expenseSeries — i.e. scoped to `range`, not all-time. */
  totalRevenueCents: number;
  totalExpensesCents: number;
  netProfitCents: number;
  /** The page-wide "Show by" filter: Revenue Overview, Expenses Overview, the
   *  Sales Overview donut, and the totals above all move together with it. */
  range: AnalyticsRange;
  granularity: 'day' | 'month';
  buckets: string[]; // "YYYY-MM-DD" (day) or "YYYY-MM" (month), oldest first
  bucketLabels: string[]; // "Mon" / "13" (day) or "May" (month)
  revenueSeries: TagSeries[];
  expenseSeries: TagSeries[];
  /** Same tag grouping and window as `revenueSeries`, so colors/legend line up. */
  salesByTag: { label: string; valueCents: number }[];
}

interface WindowBucket {
  key: string;
  label: string;
  start: Date;
}

/** `count` whole calendar months (UTC) ending at the month containing `now`. */
export function monthsWindow(count: number, now: Date): WindowBucket[] {
  const buckets: WindowBucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    buckets.push({
      key: start.toISOString().slice(0, 7),
      label: start.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
      start,
    });
  }
  return buckets;
}

/** `count` calendar days (UTC) ending at the day containing `now`. */
export function daysWindow(count: number, now: Date): WindowBucket[] {
  const buckets: WindowBucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    buckets.push({
      key: start.toISOString().slice(0, 10),
      label: start.toLocaleString('en-US', { weekday: 'short', timeZone: 'UTC' }),
      start,
    });
  }
  return buckets;
}

/**
 * Turns a named "Show by" range into the actual bucket list + granularity,
 * shared by Revenue Overview, Expenses Overview and the Sales Overview donut:
 *  - week: the last 7 days
 *  - month: month-to-date, one bucket per day so far this month
 *  - ytd: year-to-date, one bucket per month so far this year
 *  - 12months: the trailing 12 calendar months
 *
 * Day buckets default to a weekday label ("Mon"), which reads fine for a
 * 7-point week but repeats confusingly across a ~30-point month, so "month"
 * relabels each bucket with its day-of-month number instead.
 */
export function summaryWindowFor(
  range: AnalyticsRange,
  now: Date,
): { granularity: 'day' | 'month'; buckets: WindowBucket[] } {
  switch (range) {
    case 'week':
      return { granularity: 'day', buckets: daysWindow(7, now) };
    case 'month': {
      const buckets = daysWindow(now.getUTCDate(), now).map((bucket) => ({
        ...bucket,
        label: String(bucket.start.getUTCDate()),
      }));
      return { granularity: 'day', buckets };
    }
    case 'ytd':
      return { granularity: 'month', buckets: monthsWindow(now.getUTCMonth() + 1, now) };
    case '12months':
      return { granularity: 'month', buckets: monthsWindow(12, now) };
  }
}

/** Picks up to `max` tags by total value within `lines`; the rest fold into "Other". */
export function topTags(lines: TaggedLine[], max: number): string[] {
  const totals = new Map<string, number>();
  for (const line of lines) totals.set(line.tag, (totals.get(line.tag) ?? 0) + line.totalCents);
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([tag]) => tag);
}

function bucketKeyFor(iso: string, granularity: 'month' | 'day'): string {
  return granularity === 'month' ? iso.slice(0, 7) : iso.slice(0, 10);
}

/**
 * One series per tag in `keptTags` (+ "Other" if any line's tag didn't make the
 * cut), each aligned to `buckets`. Tags not in the window never produce an
 * empty-but-present series: a series only exists if it has at least one line.
 */
export function buildTagSeries(
  lines: TaggedLine[],
  buckets: WindowBucket[],
  granularity: 'month' | 'day',
  keptTags: string[],
): TagSeries[] {
  const keptSet = new Set(keptTags);
  const bucketIndex = new Map(buckets.map((bucket, index) => [bucket.key, index]));
  const valuesByLabel = new Map<string, number[]>();

  for (const line of lines) {
    const index = bucketIndex.get(bucketKeyFor(line.at, granularity));
    if (index === undefined) continue; // outside the window; shouldn't happen given the SQL `since` filter
    const label = keptSet.has(line.tag) ? line.tag : OTHER_LABEL;
    const values = valuesByLabel.get(label) ?? new Array<number>(buckets.length).fill(0);
    values[index]! += line.totalCents;
    valuesByLabel.set(label, values);
  }

  // Highest-total tags first (keptTags is already sorted that way), "Other" last.
  return [...keptTags, OTHER_LABEL]
    .filter((label) => valuesByLabel.has(label))
    .map((label) => ({ label, values: valuesByLabel.get(label)! }));
}

const MAX_TAG_SERIES = 3;

/** Horizontal bars have room for more categories than the stacked/donut charts. */
const MAX_INVENTORY_TAGS = 7;

export interface InventoryByTag {
  /** Units in stock per first tag, largest first; tags past the top 7 fold into "Other" (last). */
  byTag: { label: string; quantity: number; itemCount: number }[];
  totalQuantity: number;
  totalItems: number;
}

export interface GetSummaryOptions {
  now?: Date;
  /** The page-wide "Show by" range filter. */
  range?: AnalyticsRange;
}

export function createAnalyticsService(db: Db) {
  const repository = createAnalyticsRepository(db);

  async function getSummary(
    businessId: number,
    { now = new Date(), range = DEFAULT_ANALYTICS_RANGE }: GetSummaryOptions = {},
  ): Promise<AnalyticsSummary> {
    const { granularity, buckets } = summaryWindowFor(range, now);

    const [revenueLines, expenseLines] = await Promise.all([
      repository.revenueLines(businessId, buckets[0]!.start),
      repository.expenseLines(businessId, buckets[0]!.start),
    ]);

    // Revenue and the sales-by-tag donut share one top-tag selection, so a tag
    // (and its color/legend position) means the same thing in both charts.
    const revenueTopTags = topTags(revenueLines, MAX_TAG_SERIES);
    const expenseTopTags = topTags(expenseLines, MAX_TAG_SERIES);

    const salesByTagTotals = new Map<string, number>();
    for (const line of revenueLines) {
      const label = revenueTopTags.includes(line.tag) ? line.tag : OTHER_LABEL;
      salesByTagTotals.set(label, (salesByTagTotals.get(label) ?? 0) + line.totalCents);
    }

    const totalRevenueCents = revenueLines.reduce((sum, line) => sum + line.totalCents, 0);
    const totalExpensesCents = expenseLines.reduce((sum, line) => sum + line.totalCents, 0);

    return {
      totalRevenueCents,
      totalExpensesCents,
      netProfitCents: totalRevenueCents - totalExpensesCents,
      range,
      granularity,
      buckets: buckets.map((b) => b.key),
      bucketLabels: buckets.map((b) => b.label),
      revenueSeries: buildTagSeries(revenueLines, buckets, granularity, revenueTopTags),
      expenseSeries: buildTagSeries(expenseLines, buckets, granularity, expenseTopTags),
      salesByTag: [...salesByTagTotals.entries()]
        .map(([label, valueCents]) => ({ label, valueCents }))
        .sort((a, b) => b.valueCents - a.valueCents),
    };
  }

  /** Current stock by tag for the Inventory Overview chart. Not affected by "Show by". */
  async function getInventoryByTag(businessId: number): Promise<InventoryByTag> {
    const rows = await repository.stockByTag(businessId);
    const kept = rows.slice(0, MAX_INVENTORY_TAGS);
    const folded = rows.slice(MAX_INVENTORY_TAGS);

    const byTag = kept.map((row) => ({
      label: row.tag,
      quantity: row.quantity,
      itemCount: row.itemCount,
    }));
    if (folded.length > 0) {
      byTag.push({
        label: OTHER_LABEL,
        quantity: folded.reduce((sum, row) => sum + row.quantity, 0),
        itemCount: folded.reduce((sum, row) => sum + row.itemCount, 0),
      });
    }

    return {
      byTag,
      totalQuantity: rows.reduce((sum, row) => sum + row.quantity, 0),
      totalItems: rows.reduce((sum, row) => sum + row.itemCount, 0),
    };
  }

  return { getSummary, getInventoryByTag };
}

export type AnalyticsService = ReturnType<typeof createAnalyticsService>;
