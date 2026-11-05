import type { CurrencyRates } from '../types';
import { apiRequest } from './http';

export function getCurrencyRates(): Promise<CurrencyRates> {
  return apiRequest('/currencies');
}
