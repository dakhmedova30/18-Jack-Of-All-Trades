import type {
  AnalyticsDateRange,
  AnalyticsRange,
  AnalyticsSummary,
  DateRange,
  InventoryByTag,
} from '../types';
import { apiRequest } from './http';

/**
 * @param query A "Show by" range (week, month, ytd, or 12months, the default) or a period of
 *   whole days, both included.
 */
export function getAnalyticsSummary(query?: AnalyticsRange | DateRange): Promise<AnalyticsSummary> {
  const params =
    query === undefined
      ? ''
      : `?${new URLSearchParams(typeof query === 'string' ? { range: query } : { from: query.from, to: query.to })}`;
  return apiRequest(`/analytics/summary${params}`);
}

/** The first and last day with a sale or expense, for the date filter. */
export function getAnalyticsDateRange(): Promise<AnalyticsDateRange> {
  return apiRequest('/analytics/date-range');
}

/** Current stock by first tag, for the Inventory Overview chart. */
export function getInventoryByTag(): Promise<InventoryByTag> {
  return apiRequest('/analytics/inventory');
}
