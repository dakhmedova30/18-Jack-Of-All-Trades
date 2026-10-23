import type {
  Expense,
  ExpenseInput,
  ExpenseMonthBreakdown,
  ExpenseSortField,
  Paginated,
  SortOrder,
} from '../types';
import { apiRequest } from './http';

export interface ListExpensesParams {
  page: number;
  pageSize: number;
  search?: string;
  /** Server default: newest expense first. */
  sort?: ExpenseSortField;
  order?: SortOrder;
}

export function listExpenses({
  page,
  pageSize,
  search,
  sort,
  order,
}: ListExpensesParams): Promise<Paginated<Expense>> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) query.set('search', search);
  if (sort) query.set('sort', sort);
  if (order) query.set('order', order);
  return apiRequest(`/expenses?${query}`);
}

/** This month's spending split into restocks vs running costs. */
export function getExpenseMonthBreakdown(): Promise<ExpenseMonthBreakdown> {
  return apiRequest('/expenses/month-breakdown');
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
