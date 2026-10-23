import type { AnalyticsRange, AnalyticsSummary, InventoryByTag } from '../types';
import { apiRequest } from './http';

/** @param range The page-wide "Show by" filter: week, month, ytd, or 12months (default). */
export function getAnalyticsSummary(range?: AnalyticsRange): Promise<AnalyticsSummary> {
  const query = range !== undefined ? `?range=${range}` : '';
  return apiRequest(`/analytics/summary${query}`);
}

/** Current stock by first tag, for the Inventory Overview chart. */
export function getInventoryByTag(): Promise<InventoryByTag> {
  return apiRequest('/analytics/inventory');
}
