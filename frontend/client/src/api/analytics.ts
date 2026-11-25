import type {
  AnalyticsDateRange,
  AnalyticsRange,
  AnalyticsSummary,
  DateRange,
  ExpenseTrends,
  SalesTrends,
  StockHealth,
} from '../types';
import { apiRequest } from './http';

/**
 * @param query A "Show by" range (week, month, ytd, or 12months, the default) or a period of
 *   whole days, both included.
 * @param channelId Only this channel's sales count; expenses have no channel, so they're unaffected.
 */
export function getAnalyticsSummary(
  query?: AnalyticsRange | DateRange,
  channelId?: number,
): Promise<AnalyticsSummary> {
  const params = new URLSearchParams();
  if (typeof query === 'string') params.set('range', query);
  else if (query) {
    params.set('from', query.from);
    params.set('to', query.to);
  }
  if (channelId) params.set('channelId', String(channelId));
  const search = params.toString();
  return apiRequest(`/analytics/summary${search ? `?${search}` : ''}`);
}

/** The first and last day with a sale or expense, for the date filter. */
export function getAnalyticsDateRange(): Promise<AnalyticsDateRange> {
  return apiRequest('/analytics/date-range');
}

/**
 * `?from=…&to=…` for a period (without one, the server's default: the last 12 months), plus each
 * of `filters` that is set, a list as the name repeated (`channelId=1&channelId=3`); nothing for none.
 */
function trendsQuery(
  period?: DateRange,
  filters: Record<string, readonly (string | number)[] | undefined> = {},
): string {
  const params = new URLSearchParams();
  if (period) {
    params.set('from', period.from);
    params.set('to', period.to);
  }
  for (const [name, values] of Object.entries(filters)) {
    for (const value of values ?? []) params.append(name, String(value));
  }
  const search = params.toString();
  return search ? `?${search}` : '';
}

/**
 * Sales Analytics' charts for a period of whole days, both included (by day, week or month, by
 * its length): revenue (in all and by channel) and sale count over time, by weekday and by channel.
 *
 * @param channelIds Only these channels' sales count, in every chart; all of them without.
 */
export function getSalesTrends(period?: DateRange, channelIds?: number[]): Promise<SalesTrends> {
  return apiRequest(`/analytics/sales-trends${trendsQuery(period, { channelId: channelIds })}`);
}

/**
 * Expense Analytics' charts for a period of whole days, both included: restock and running costs
 * over time next to revenue, and spending by tag.
 *
 * @param tags Only expenses whose first tag ("Untagged" for none) is one of these count, all of
 *   them without; revenue is unaffected.
 */
export function getExpenseTrends(period?: DateRange, tags?: string[]): Promise<ExpenseTrends> {
  return apiRequest(`/analytics/expense-trends${trendsQuery(period, { tag: tags })}`);
}

/**
 * Every first tag on the business's expenses, by name with "Untagged" last: the choices of Expense
 * Analytics' tag filter. Unlike listExpenseTags, it includes tags removed from the form's list.
 */
export function getExpenseTagsInUse(): Promise<string[]> {
  return apiRequest('/analytics/expense-tags');
}

/** Inventory Analytics' charts: stock levels, stock value by tag and what will run out first. */
export function getStockHealth(): Promise<StockHealth> {
  return apiRequest('/analytics/stock-health');
}
