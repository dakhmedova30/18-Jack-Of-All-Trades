import type { CurrencyCode, OnlineExpense, OnlineExpenseInput, OnlineMonth } from '../types';
import { apiRequest } from './http';

export function listOnlineMonths(currency: CurrencyCode): Promise<OnlineMonth[]> {
  return apiRequest(`/online-shop/months?currency=${currency}`);
}

export function deleteOnlineMonths(months: string[]): Promise<{ deleted: number }> {
  return apiRequest('/online-shop/months/bulk-delete', { method: 'POST', json: { months } });
}

export function listOnlineExpenses(month?: string): Promise<OnlineExpense[]> {
  return apiRequest(month ? `/online-shop/expenses?month=${month}` : '/online-shop/expenses');
}

export function createOnlineExpense(input: OnlineExpenseInput): Promise<OnlineExpense> {
  return apiRequest('/online-shop/expenses', { method: 'POST', json: input });
}

export function updateOnlineExpense(id: number, input: OnlineExpenseInput): Promise<OnlineExpense> {
  return apiRequest(`/online-shop/expenses/${id}`, { method: 'PATCH', json: input });
}

export function deleteOnlineExpense(id: number): Promise<void> {
  return apiRequest(`/online-shop/expenses/${id}`, { method: 'DELETE' });
}

export function bulkDeleteOnlineExpenses(ids: number[]): Promise<{ deleted: number }> {
  return apiRequest('/online-shop/expenses/bulk-delete', { method: 'POST', json: { ids } });
}
