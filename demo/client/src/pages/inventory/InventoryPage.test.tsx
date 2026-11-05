import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authApi from '../../api/auth';
import * as itemApi from '../../api/items';
import { testItem } from '../../test/fixtures';
import { PageProviders } from '../../test/providers';
import { InventoryPage } from './InventoryPage';

vi.mock('../../api/auth', () => ({
  getCurrentBusiness: vi.fn(),
}));

vi.mock('../../api/items', () => ({
  bulkDeleteItems: vi.fn(),
  bulkSetItemsPublic: vi.fn(),
  createItem: vi.fn(),
  deleteItem: vi.fn(),
  getInventoryInsights: vi.fn(),
  getLowStock: vi.fn(),
  listItems: vi.fn(),
  updateItem: vi.fn(),
}));

/** The bulk show/hide message links to Settings, so that test needs a router too. */
function RoutedPageProviders({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <PageProviders>{children}</PageProviders>
    </MemoryRouter>
  );
}

describe('InventoryPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(authApi.getCurrentBusiness).mockResolvedValue(undefined);
    vi.mocked(itemApi.listItems).mockResolvedValue({
      data: [testItem],
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
    render(<InventoryPage />, { wrapper: PageProviders });

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
    render(<InventoryPage />, { wrapper: PageProviders });

    await screen.findByText('Tea');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Coffee');
    await user.type(screen.getByRole('textbox', { name: 'Qty' }), '5');
    await user.type(screen.getByRole('textbox', { name: /^Unit price \(CAD\)/ }), '3.25');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Could not save item')).toBeInTheDocument();
    await waitFor(() =>
      expect(itemApi.createItem).toHaveBeenCalledWith({
        name: 'Coffee',
        quantity: 5,
        unitPriceCents: 325,
        tags: [],
        note: '',
        isPublic: false,
      }),
    );
  });

  it('shows the selected items on the public profile, and says when the profile is off', async () => {
    const user = userEvent.setup();
    vi.mocked(itemApi.bulkSetItemsPublic).mockResolvedValue({ updated: 1 });
    render(<InventoryPage />, { wrapper: RoutedPageProviders });

    await screen.findByText('Tea');
    const show = screen.getByRole('button', { name: 'Show on profile' });
    expect(show).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: 'Select Tea' }));
    await user.click(screen.getByRole('button', { name: 'Show on profile (1)' }));

    expect(itemApi.bulkSetItemsPublic).toHaveBeenCalledWith([testItem.id], true);
    expect(await screen.findByRole('status')).toHaveTextContent(
      "1 item now on your public profile. Your public profile is off, so customers can't see it yet.",
    );
    expect(screen.getByRole('link', { name: 'Turn it on in Settings > Profile' })).toHaveAttribute(
      'href',
      '/settings/profile',
    );
    // The selection is cleared once the change is saved.
    expect(screen.getByRole('button', { name: 'Show on profile' })).toBeDisabled();
  });

  it('shows an error when changing visibility fails', async () => {
    const user = userEvent.setup();
    vi.mocked(itemApi.bulkSetItemsPublic).mockRejectedValue(new Error('Could not update items'));
    render(<InventoryPage />, { wrapper: RoutedPageProviders });

    await screen.findByText('Tea');
    await user.click(screen.getByRole('checkbox', { name: 'Select Tea' }));
    await user.click(screen.getByRole('button', { name: 'Hide from profile (1)' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not update items');
    expect(itemApi.bulkSetItemsPublic).toHaveBeenCalledWith([testItem.id], false);
  });
});
