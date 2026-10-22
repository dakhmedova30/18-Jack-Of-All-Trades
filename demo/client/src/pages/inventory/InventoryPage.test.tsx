import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as itemApi from '../../api/items';
import { InventoryPage } from './InventoryPage';

vi.mock('../../api/items', () => ({
  bulkDeleteItems: vi.fn(),
  createItem: vi.fn(),
  deleteItem: vi.fn(),
  getInventoryInsights: vi.fn(),
  getLowStock: vi.fn(),
  listItems: vi.fn(),
  updateItem: vi.fn(),
}));

const item = {
  id: 1,
  name: 'Tea',
  quantity: 12,
  unitPriceCents: 450,
  tags: ['Drinks'],
  note: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('InventoryPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(itemApi.listItems).mockResolvedValue({
      data: [item],
      page: 1,
      pageSize: 15,
      total: 1,
      totalPages: 1,
    });
    vi.mocked(itemApi.getLowStock).mockResolvedValue({
      count: 0,
      threshold: 5,
      items: [],
    });
    vi.mocked(itemApi.getInventoryInsights).mockResolvedValue({
      stockValueCents: 5400,
      totalUnits: 12,
      periodStart: '2026-10-01',
      periodEnd: '2026-11-01',
      bestSellers: [],
    });
  });

  it('loads and displays items, and opens and cancels the add form', async () => {
    const user = userEvent.setup();
    render(<InventoryPage />);

    expect(await screen.findByText('Tea')).toBeInTheDocument();
    expect(screen.getByText('4.50 CAD')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('dialog', { name: 'Add new item' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Add new item' })).not.toBeInTheDocument();
  });

  it('shows an error when saving a new item fails', async () => {
    const user = userEvent.setup();
    vi.mocked(itemApi.createItem).mockRejectedValue(new Error('Could not save item'));
    render(<InventoryPage />);

    await screen.findByText('Tea');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.type(screen.getByLabelText('Name'), 'Coffee');
    await user.type(screen.getByLabelText('Qty'), '5');
    await user.type(screen.getByLabelText('Unit price (CAD)'), '3.25');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Could not save item')).toBeInTheDocument();
    await waitFor(() =>
      expect(itemApi.createItem).toHaveBeenCalledWith({
        name: 'Coffee',
        quantity: 5,
        unitPriceCents: 325,
        tags: [],
        note: '',
      }),
    );
  });
});
