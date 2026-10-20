import type { Expense, ExpenseInput, Paginated } from '../types';
import { apiRequest } from './http';

export interface ListExpensesParams {
  page: number;
  pageSize: number;
  search?: string;
}

export function listExpenses({
  page,
  pageSize,
  search,
}: ListExpensesParams): Promise<Paginated<Expense>> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) query.set('search', search);
  return apiRequest(`/expenses?${query}`);
}

export function createExpense(input: ExpenseInput): Promise<Expense> {
  return apiRequest('/expenses', { method: 'POST', json: input });
}

export function updateExpense(id: number, input: ExpenseInput): Promise<Expense> {
  return apiRequest(`/expenses/${id}`, { method: 'PATCH', json: input });
}

export function deleteExpense(id: number): Promise<void> {
  return apiRequest(`/expenses/${id}`, { method: 'DELETE' });
}

export function bulkDeleteExpenses(ids: number[]): Promise<{ deleted: number }> {
  return apiRequest('/expenses/bulk-delete', { method: 'POST', json: { ids } });
}
