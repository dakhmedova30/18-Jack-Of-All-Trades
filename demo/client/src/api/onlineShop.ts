import type { OnlineShopSummary } from '../types';
import { apiRequest } from './http';

export function getOnlineShopMonthlySummary(month: string): Promise<OnlineShopSummary> {
  const query = new URLSearchParams({ month });
  return apiRequest(`/online-shop/monthly-summary?${query}`);
}
