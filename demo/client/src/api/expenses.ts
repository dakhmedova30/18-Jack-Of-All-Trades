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
  tag?: string;
  partyName?: string;
  subcategory?: string;
  currency?: string;
  from?: string;
  to?: string;
}

export function listExpenses({
  page,
  pageSize,
  search,
  sort,
  order,
  tag,
  partyName,
  subcategory,
  currency,
  from,
  to,
}: ListExpensesParams): Promise<Paginated<Expense>> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) query.set('search', search);
  if (sort) query.set('sort', sort);
  if (order) query.set('order', order);
  if (tag) query.set('tag', tag);
  if (partyName) query.set('partyName', partyName);
  if (subcategory) query.set('subcategory', subcategory);
  if (currency) query.set('currency', currency);
  if (from) query.set('from', from);
  if (to) query.set('to', to);
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
