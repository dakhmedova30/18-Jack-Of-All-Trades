import type { ExpenseTag } from '../types';
import { apiRequest } from './http';

export function listExpenseTags(): Promise<ExpenseTag[]> {
  return apiRequest('/expense-tags');
}

export function createExpenseTag(name: string): Promise<ExpenseTag> {
  return apiRequest('/expense-tags', { method: 'POST', json: { name } });
}

/** Also renames the tag on existing expenses. */
export function renameExpenseTag(id: number, name: string): Promise<ExpenseTag> {
  return apiRequest(`/expense-tags/${id}`, { method: 'PUT', json: { name } });
}

/** Only removes it from the dropdown list; expenses keep their tag. */
export function deleteExpenseTag(id: number): Promise<void> {
  return apiRequest(`/expense-tags/${id}`, { method: 'DELETE' });
}
