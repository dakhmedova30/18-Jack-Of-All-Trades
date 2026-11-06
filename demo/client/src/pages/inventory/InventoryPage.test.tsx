import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authApi from '../../api/auth';
import * as itemApi from '../../api/items';
import { testItem } from '../../test/fixtures';
import type { InventoryInsights } from '../../types';
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
      notSelling: [],
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
    await user.click(screen.getByRole('button', { name: 'Show on profile (1)' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not update items');
    expect(itemApi.bulkSetItemsPublic).toHaveBeenCalledWith([testItem.id], true);
  });

  it('only enables the visibility action that would change something', async () => {
    const user = userEvent.setup();
    render(<InventoryPage />, { wrapper: RoutedPageProviders });

    await screen.findByText('Tea');
    await user.click(screen.getByRole('checkbox', { name: 'Select Tea' }));

    // Tea is private: it can be shown, but there's nothing to hide.
    expect(screen.getByRole('button', { name: 'Show on profile (1)' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Hide from profile' })).toBeDisabled();
  });

  it('lists the items a mixed selection skips, and changes only the others', async () => {
    const user = userEvent.setup();
    const coffee = { ...testItem, id: 2, name: 'Coffee', isPublic: true };
    const juice = { ...testItem, id: 3, name: 'Juice' };
    vi.mocked(itemApi.listItems).mockResolvedValue({
      data: [testItem, coffee, juice],
      page: 1,
      pageSize: 15,
      total: 3,
      totalPages: 1,
    });
    vi.mocked(itemApi.bulkSetItemsPublic).mockResolvedValue({ updated: 2 });
    render(<InventoryPage />, { wrapper: RoutedPageProviders });

    await screen.findByText('Tea');
    await user.click(screen.getByRole('checkbox', { name: 'Select all items on this page' }));
    expect(screen.getByRole('button', { name: 'Hide from profile (1)' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Show on profile (2)' }));

    const dialog = screen.getByRole('dialog', { name: 'Show on public profile' });
    expect(dialog).toHaveTextContent(
      '“Coffee” is already on your public profile, so it stays as it is. Show the other 2 items?',
    );
    expect(itemApi.bulkSetItemsPublic).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Show 2 items' }));
    expect(itemApi.bulkSetItemsPublic).toHaveBeenCalledWith([testItem.id, juice.id], true);
    expect(await screen.findByRole('status')).toHaveTextContent(
      '2 items now on your public profile.',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  describe('Not selling panel', () => {
    const unsold: InventoryInsights['notSelling'] = [
      { id: 2, name: 'Bookmark', quantity: 9 },
      { id: 3, name: 'Card', quantity: 4 },
      { id: 4, name: 'Notebook', quantity: 6 },
      { id: 5, name: 'Tote', quantity: 2 },
    ];

    function mockNotSelling(notSelling: InventoryInsights['notSelling']) {
      vi.mocked(itemApi.getInventoryInsights).mockResolvedValue({
        stockValueCents: 5400,
        totalUnits: 12,
        periodStart: '2026-10-01',
        periodEnd: '2026-11-01',
        bestSellers: [],
        notSelling,
      });
    }

    async function findPanel(title: string) {
      const heading = await screen.findByRole('heading', { name: title });
      return within(heading.closest('section')!);
    }

    it('lists in-stock items with no sales this month, the first three at a time', async () => {
      mockNotSelling(unsold);
      render(<InventoryPage />, { wrapper: PageProviders });

      const panel = await findPanel('Not selling (4)');
      expect(panel.getByText('October, no sales')).toBeInTheDocument();
      expect(panel.getByText('Bookmark')).toBeInTheDocument();
      expect(panel.getByText('9 left')).toBeInTheDocument();
      expect(panel.getByText('Notebook')).toBeInTheDocument();
      expect(panel.queryByText('Tote')).not.toBeInTheDocument();
    });

    it('expands to the whole list and back', async () => {
      const user = userEvent.setup();
      mockNotSelling(unsold);
      render(<InventoryPage />, { wrapper: PageProviders });

      const panel = await findPanel('Not selling (4)');
      await user.click(panel.getByRole('button', { name: 'Expand list' }));
      expect(panel.getByText('Tote')).toBeInTheDocument();
      expect(panel.getByRole('button', { name: 'Show less' })).toHaveAttribute(
        'aria-expanded',
        'true',
      );

      await user.click(panel.getByRole('button', { name: 'Show less' }));
      expect(panel.queryByText('Tote')).not.toBeInTheDocument();
    });

    it('says so when every in-stock item has sold this month', async () => {
      mockNotSelling([]);
      render(<InventoryPage />, { wrapper: PageProviders });

      const panel = await findPanel('Not selling (0)');
      expect(panel.getByText('Every in-stock item has sold this month.')).toBeInTheDocument();
      expect(panel.queryByRole('button', { name: 'Expand list' })).not.toBeInTheDocument();
    });
  });
});
