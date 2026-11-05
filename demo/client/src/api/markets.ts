import type { Market, MarketInput, MarketSale, MarketSaleInput } from '../types';
import { apiRequest } from './http';

export function listMarkets(): Promise<Market[]> {
  return apiRequest('/markets');
}

export function createMarket(input: MarketInput): Promise<Market> {
  return apiRequest('/markets', { method: 'POST', json: input });
}

export function updateMarket(id: number, input: MarketInput): Promise<Market> {
  return apiRequest(`/markets/${id}`, { method: 'PUT', json: input });
}

export function deleteMarket(id: number): Promise<void> {
  return apiRequest(`/markets/${id}`, { method: 'DELETE' });
}

export function createMarketSale(marketId: number, input: MarketSaleInput): Promise<MarketSale> {
  return apiRequest(`/markets/${marketId}/sales`, { method: 'POST', json: input });
}

export function updateMarketSale(
  marketId: number,
  saleId: number,
  input: MarketSaleInput,
): Promise<MarketSale> {
  return apiRequest(`/markets/${marketId}/sales/${saleId}`, { method: 'PUT', json: input });
}

export function deleteMarketSale(marketId: number, saleId: number): Promise<void> {
  return apiRequest(`/markets/${marketId}/sales/${saleId}`, { method: 'DELETE' });
}
