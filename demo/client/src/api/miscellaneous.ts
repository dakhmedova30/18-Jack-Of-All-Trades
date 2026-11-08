import type { MiscExpense, MiscellaneousInput, MiscellaneousRecord, OnlineExpenseInput } from '../types';
import { apiRequest } from './http';

export function listMiscellaneous(): Promise<MiscellaneousRecord[]> {
  return apiRequest('/miscellaneous');
}

export function getMiscellaneous(id: number): Promise<MiscellaneousRecord> {
  return apiRequest(`/miscellaneous/${id}`);
}

export function createMiscellaneous(input: MiscellaneousInput): Promise<MiscellaneousRecord> {
  return apiRequest('/miscellaneous', { method: 'POST', json: input });
}

export function updateMiscellaneous(id: number, input: MiscellaneousInput): Promise<MiscellaneousRecord> {
  return apiRequest(`/miscellaneous/${id}`, { method: 'PATCH', json: input });
}

export function deleteMiscellaneous(id: number): Promise<void> {
  return apiRequest(`/miscellaneous/${id}`, { method: 'DELETE' });
}

export function bulkDeleteMiscellaneous(ids: number[]): Promise<{ deleted: number }> {
  return apiRequest('/miscellaneous/bulk-delete', { method: 'POST', json: { ids } });
}

export function listMiscExpenses(miscId: number): Promise<MiscExpense[]> {
  return apiRequest(`/miscellaneous/${miscId}/expenses`);
}

export function createMiscExpense(miscId: number, input: OnlineExpenseInput): Promise<MiscExpense> {
  return apiRequest(`/miscellaneous/${miscId}/expenses`, { method: 'POST', json: input });
}

export function updateMiscExpense(
  miscId: number,
  id: number,
  input: OnlineExpenseInput,
): Promise<MiscExpense> {
  return apiRequest(`/miscellaneous/${miscId}/expenses/${id}`, { method: 'PATCH', json: input });
}

export function deleteMiscExpense(miscId: number, id: number): Promise<void> {
  return apiRequest(`/miscellaneous/${miscId}/expenses/${id}`, { method: 'DELETE' });
}

export function bulkDeleteMiscExpenses(miscId: number, ids: number[]): Promise<{ deleted: number }> {
  return apiRequest(`/miscellaneous/${miscId}/expenses/bulk-delete`, { method: 'POST', json: { ids } });
}

export function listUnassignedMiscExpenses(): Promise<MiscExpense[]> {
  return apiRequest('/miscellaneous/expenses/unassigned');
}

export function deleteUnassignedMiscExpense(id: number): Promise<void> {
  return apiRequest(`/miscellaneous/expenses/unassigned/${id}`, { method: 'DELETE' });
}

export function bulkDeleteUnassignedMiscExpenses(ids: number[]): Promise<{ deleted: number }> {
  return apiRequest('/miscellaneous/expenses/unassigned/bulk-delete', { method: 'POST', json: { ids } });
}
