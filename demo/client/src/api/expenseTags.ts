import type { ExpenseTag } from '../types';
import { apiRequest } from './http';

export function listExpenseTags(): Promise<ExpenseTag[]> {
  return apiRequest('/expense-tags');
}

export function createExpenseTag(name: string): Promise<ExpenseTag> {
  return apiRequest('/expense-tags', { method: 'POST', json: { name } });
}
