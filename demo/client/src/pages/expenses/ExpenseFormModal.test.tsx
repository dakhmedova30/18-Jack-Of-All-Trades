import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as expenseTagApi from '../../api/expenseTags';
import * as itemApi from '../../api/items';
import { ExpenseFormModal } from './ExpenseFormModal';

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
    render(<ExpenseFormModal onCancel={vi.fn()} onSubmit={onSubmit} />);

    await screen.findByLabelText('Tag');
    await user.type(screen.getByPlaceholderText('Rent, packaging tape, …'), 'Rent');
    await user.type(screen.getByLabelText('Unit cost'), '125.50');
    await user.type(screen.getByLabelText('Date'), '2026-10-20');
    await user.selectOptions(await screen.findByLabelText('Tag'), 'Utilities');
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
});
