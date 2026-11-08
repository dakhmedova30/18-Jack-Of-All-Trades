import type {
  Commission,
  CommissionExpense,
  CommissionInput,
  OnlineExpenseInput,
} from '../types';
import { apiRequest } from './http';

export function listCommissions(): Promise<Commission[]> {
  return apiRequest('/commissions');
}

export function getCommission(id: number): Promise<Commission> {
  return apiRequest(`/commissions/${id}`);
}

export function createCommission(input: CommissionInput): Promise<Commission> {
  return apiRequest('/commissions', { method: 'POST', json: input });
}

export function updateCommission(id: number, input: CommissionInput): Promise<Commission> {
  return apiRequest(`/commissions/${id}`, { method: 'PATCH', json: input });
}

export function deleteCommission(id: number): Promise<void> {
  return apiRequest(`/commissions/${id}`, { method: 'DELETE' });
}

export function bulkDeleteCommissions(ids: number[]): Promise<{ deleted: number }> {
  return apiRequest('/commissions/bulk-delete', { method: 'POST', json: { ids } });
}

export function listCommissionExpenses(commissionId: number): Promise<CommissionExpense[]> {
  return apiRequest(`/commissions/${commissionId}/expenses`);
}

export function listUnassignedCommissionExpenses(): Promise<CommissionExpense[]> {
  return apiRequest('/commissions/expenses/unassigned');
}

export function deleteUnassignedCommissionExpense(id: number): Promise<void> {
  return apiRequest(`/commissions/expenses/unassigned/${id}`, { method: 'DELETE' });
}

export function bulkDeleteUnassignedCommissionExpenses(ids: number[]): Promise<{ deleted: number }> {
  return apiRequest('/commissions/expenses/unassigned/bulk-delete', { method: 'POST', json: { ids } });
}

export function createCommissionExpense(
  commissionId: number,
  input: OnlineExpenseInput,
): Promise<CommissionExpense> {
  return apiRequest(`/commissions/${commissionId}/expenses`, { method: 'POST', json: input });
}

export function updateCommissionExpense(
  commissionId: number,
  id: number,
  input: OnlineExpenseInput,
): Promise<CommissionExpense> {
  return apiRequest(`/commissions/${commissionId}/expenses/${id}`, { method: 'PATCH', json: input });
}

export function deleteCommissionExpense(commissionId: number, id: number): Promise<void> {
  return apiRequest(`/commissions/${commissionId}/expenses/${id}`, { method: 'DELETE' });
}

export function bulkDeleteCommissionExpenses(
  commissionId: number,
  ids: number[],
): Promise<{ deleted: number }> {
  return apiRequest(`/commissions/${commissionId}/expenses/bulk-delete`, {
    method: 'POST',
    json: { ids },
  });
}
