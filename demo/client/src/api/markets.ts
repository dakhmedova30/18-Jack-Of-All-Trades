import type { Market, MarketInput } from '../types';
import { apiRequest } from './http';

export function listMarkets(): Promise<Market[]> {
  return apiRequest('/markets');
}

export function getMarket(id: number): Promise<Market> {
  return apiRequest(`/markets/${id}`);
}

export function createMarket(input: MarketInput): Promise<Market> {
  return apiRequest('/markets', { method: 'POST', json: input });
}

export function updateMarket(id: number, input: MarketInput): Promise<Market> {
  return apiRequest(`/markets/${id}`, { method: 'PATCH', json: input });
}

export function deleteMarket(id: number): Promise<void> {
  return apiRequest(`/markets/${id}`, { method: 'DELETE' });
}

export function bulkDeleteMarkets(ids: number[]): Promise<{ deleted: number }> {
  return apiRequest('/markets/bulk-delete', { method: 'POST', json: { ids } });
}
