import { render, screen, waitFor, within } from '@testing-library/react';
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

  it('does not send an old CSV stock quantity when importing an existing item', async () => {
    const user = userEvent.setup();
    vi.mocked(itemApi.updateItem).mockResolvedValue(testItem);
    render(<InventoryPage />, { wrapper: PageProviders });
    await screen.findByText('Tea');
    const csv = 'id,name,quantity,unitPriceCents,tags,note,isPublic\n1,Tea,15,450,[],old,false';
    const file = new File([csv], 'inventory.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'text', { value: async () => csv });
    await user.upload(screen.getByLabelText('Import inventory CSV'), file);
    const dialog = await screen.findByRole('dialog', { name: 'Confirm CSV Import' });
    await user.click(within(dialog).getByRole('button', { name: 'Import CSV' }));
    await waitFor(() => expect(itemApi.updateItem).toHaveBeenCalledTimes(1));
    expect(itemApi.updateItem).toHaveBeenCalledWith(1, {
      name: 'Tea',
      unitPriceCents: 450,
      tags: [],
      note: 'old',
      isPublic: false,
    });
  });

  /** The stock shown in the Qty column of `name`'s row. */
  function stockFor(name: string): string | undefined {
    const row = screen.getByRole('row', { name: `Edit ${name}` });
    return within(row).getAllByRole('cell')[3]?.textContent ?? undefined;
  }

  it('adds a product, then lists it with the stock entered', async () => {
    const user = userEvent.setup();
    const coffee = { ...testItem, id: 2, name: 'Coffee', quantity: 5, unitPriceCents: 325 };
    vi.mocked(itemApi.createItem).mockResolvedValue(coffee);
    render(<InventoryPage />, { wrapper: PageProviders });
    await screen.findByText('Tea');

    // The list the server returns once the product exists.
    vi.mocked(itemApi.listItems).mockResolvedValue({
      data: [testItem, coffee],
      page: 1,
      pageSize: 15,
      total: 2,
      totalPages: 1,
    });
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Coffee');
    await user.type(screen.getByRole('textbox', { name: 'Qty' }), '5');
    await user.type(screen.getByRole('textbox', { name: /^Unit price \(CAD\)/ }), '3.25');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(itemApi.createItem).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Coffee', quantity: 5, unitPriceCents: 325 }),
    );
    expect(await screen.findByText('Coffee')).toBeInTheDocument();
    expect(stockFor('Coffee')).toBe('5');
    expect(screen.queryByRole('dialog', { name: 'Add new item' })).not.toBeInTheDocument();
  });

  it("changes an existing item's quantity, then shows the new stock", async () => {
    const user = userEvent.setup();
    const restocked = { ...testItem, quantity: 20 };
    vi.mocked(itemApi.updateItem).mockResolvedValue(restocked);
    render(<InventoryPage />, { wrapper: PageProviders });
    await screen.findByText('Tea');
    expect(stockFor('Tea')).toBe('12');

    vi.mocked(itemApi.listItems).mockResolvedValue({
      data: [restocked],
      page: 1,
      pageSize: 15,
      total: 1,
      totalPages: 1,
    });
    await user.click(screen.getByRole('row', { name: 'Edit Tea' }));
    const qty = screen.getByRole('textbox', { name: 'Qty' });
    await user.clear(qty);
    await user.type(qty, '20');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(itemApi.updateItem).toHaveBeenCalledWith(
      testItem.id,
      expect.objectContaining({ quantity: 20 }),
    );
    await waitFor(() => expect(stockFor('Tea')).toBe('20'));
  });

  it('shows the selected items on the public profile, and says when the profile is off', async () => {
    const user = userEvent.setup();
    vi.mocked(itemApi.bulkSetItemsPublic).mockResolvedValue({ updated: 1 });
    render(<InventoryPage />, { wrapper: RoutedPageProviders });

    await screen.findByText('Tea');
    expect(screen.queryByRole('button', { name: 'Show on profile' })).not.toBeInTheDocument();

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
    expect(screen.queryByRole('button', { name: 'Show on profile' })).not.toBeInTheDocument();
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
});
