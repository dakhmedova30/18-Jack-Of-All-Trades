import type { MiscellaneousSummary } from '../types';
import { apiRequest } from './http';

export function getMiscellaneousSummary(): Promise<MiscellaneousSummary> {
  return apiRequest('/miscellaneous/summary');
}
