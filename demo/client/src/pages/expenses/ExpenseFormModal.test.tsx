import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authApi from '../../api/auth';
import * as expenseTagApi from '../../api/expenseTags';
import * as itemApi from '../../api/items';
import { PageProviders } from '../../test/providers';
import type { Expense } from '../../types';
import { ExpenseFormModal } from './ExpenseFormModal';

// Required fields' labels end in a "*" (hidden from screen readers), so labels are matched by
// how they start.

vi.mock('../../api/auth', () => ({
  getCurrentBusiness: vi.fn(),
}));

vi.mock('../../api/expenseTags', () => ({
  createExpenseTag: vi.fn(),
  listExpenseTags: vi.fn(),
}));

vi.mock('../../api/items', () => ({
  listItems: vi.fn(),
}));

describe('ExpenseFormModal', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(authApi.getCurrentBusiness).mockResolvedValue(undefined);
    vi.mocked(itemApi.listItems).mockResolvedValue({
      data: [],
      page: 1,
      pageSize: 100,
      total: 0,
      totalPages: 0,
    });
    vi.mocked(expenseTagApi.listExpenseTags).mockResolvedValue([{ id: 1, name: 'Utilities' }]);
  });

  it('submits a free-text expense with its date, tag, and cost', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ExpenseFormModal onCancel={vi.fn()} onSubmit={onSubmit} />, { wrapper: PageProviders });

    await screen.findByLabelText(/^Tag\b/);
    await user.type(screen.getByPlaceholderText('Rent, packaging tape, …'), 'Rent');
    await user.type(screen.getByLabelText(/^Unit cost\b/), '125.50');
    await user.type(screen.getByLabelText(/^Date\b/), '2026-10-20');
    await user.selectOptions(await screen.findByLabelText(/^Tag\b/), 'Utilities');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith({
      incurredAt: '2026-10-20T00:00:00.000Z',
      description: '',
      tags: ['Utilities'],
      items: [
        {
          itemId: null,
          description: 'Rent',
          quantity: 1,
          unitCostCents: 12550,
        },
      ],
    });
  });

  it('edits an expense in the currency it was recorded in', async () => {
    // A list row after the account switched from EUR to CAD: the total is converted for
    // display, but the cost stays in euros, and the server keeps it in euros when saved.
    const euroExpense: Expense = {
      id: 3,
      incurredAt: '2026-10-20T00:00:00.000Z',
      description: '',
      tags: ['Utilities'],
      totalCents: 15000,
      currency: 'CAD',
      originalAmount: 100,
      originalCurrency: 'EUR',
      items: [
        {
          id: 1,
          itemId: null,
          itemName: 'Rent',
          quantity: 1,
          unitCostCents: 10000,
          totalCents: 10000,
        },
      ],
      createdAt: '2026-10-20T00:00:00.000Z',
      updatedAt: '2026-10-20T00:00:00.000Z',
    };
    render(<ExpenseFormModal expense={euroExpense} onCancel={vi.fn()} onSubmit={vi.fn()} />, {
      wrapper: PageProviders,
    });

    // The line total and the grand total.
    await waitFor(() => expect(screen.getAllByText('100.00 EUR')).toHaveLength(2));
    expect(screen.queryByText(/CAD$/)).not.toBeInTheDocument();
  });
});
