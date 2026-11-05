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

/** Current stock by first tag, for the Inventory Overview chart. */
export function getInventoryByTag(): Promise<InventoryByTag> {
  return apiRequest('/analytics/inventory');
}
