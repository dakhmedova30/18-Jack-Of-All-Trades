import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ExpenseLineReport } from '../../types';
import { ExpenseLineReportView } from './ExpenseLineReport';

const lines: ExpenseLineReport[] = [
  {
    lineId: 1,
    expenseId: 12,
    incurredAt: '2026-11-09T00:00:00.000Z',
    expenseDescription: 'Supply order',
    currency: 'CAD',
    originalCurrency: 'CAD',
    itemName: 'Clay',
    quantity: 2,
    unitCostCents: 500,
    totalCents: 1000,
    displayTotalCents: 1000,
    category: 'Materials',
    subcategory: 'Clay',
    manufacturer: 'Studio Co.',
    type: 'product',
  },
  {
    lineId: 2,
    expenseId: 13,
    incurredAt: '2026-11-08T00:00:00.000Z',
    expenseDescription: 'Shipping',
    currency: 'CAD',
    originalCurrency: 'CAD',
    itemName: 'Postage',
    quantity: 1,
    unitCostCents: 250,
    totalCents: 250,
    displayTotalCents: 250,
    category: 'Materials',
    subcategory: '',
    manufacturer: '',
    type: 'shipping',
  },
];

describe('ExpenseLineReportView', () => {
  it('expands category and sub-category groups to show linked expense lines and totals', () => {
    const onOpenExpense = vi.fn();
    render(
      <ExpenseLineReportView
        lines={lines}
        mode="category"
        currency="CAD"
        formatDate={(value) => value.slice(0, 10)}
        selectedIds={new Set()}
        onToggleExpense={vi.fn()}
        onOpenExpense={onOpenExpense}
      />,
    );

    expect(screen.getAllByText('12.50 CAD')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /Materials/ }));
    fireEvent.click(screen.getByRole('button', { name: /Uncategorized/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Expense #13' }));

    expect(onOpenExpense).toHaveBeenCalledWith(13);
    expect(screen.getByText(/Postage/)).toBeInTheDocument();
  });
});
