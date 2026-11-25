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

/** `?from=…&to=…` for a period, or nothing for the server's default (the last 12 months). */
function periodQuery(period?: DateRange): string {
  return period ? `?${new URLSearchParams({ from: period.from, to: period.to })}` : '';
}

/**
 * Sales Analytics' charts for a period of whole days, both included (by day, week or month, by
 * its length): revenue and sale count over time, by weekday and by channel.
 */
export function getSalesTrends(period?: DateRange): Promise<SalesTrends> {
  return apiRequest(`/analytics/sales-trends${periodQuery(period)}`);
}

/**
 * Expense Analytics' charts for a period of whole days, both included: restock and running costs
 * over time next to revenue, and spending by tag.
 */
export function getExpenseTrends(period?: DateRange): Promise<ExpenseTrends> {
  return apiRequest(`/analytics/expense-trends${periodQuery(period)}`);
}

/** Inventory Analytics' charts: stock levels, stock value by tag and what will run out first. */
export function getStockHealth(): Promise<StockHealth> {
  return apiRequest('/analytics/stock-health');
}
