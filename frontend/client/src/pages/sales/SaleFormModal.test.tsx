import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authApi from '../../api/auth';
import * as channelApi from '../../api/channels';
import * as itemApi from '../../api/items';
import { testItem } from '../../test/fixtures';
import type { Sale } from '../../types';
import { PageProviders } from '../../test/providers';
import { SaleFormModal } from './SaleFormModal';

// Required fields' labels end in a "*" (hidden from screen readers), so labels are matched by
// how they start.

vi.mock('../../api/auth', () => ({
  getCurrentBusiness: vi.fn(),
}));

vi.mock('../../api/channels', () => ({
  createChannel: vi.fn(),
  listChannels: vi.fn(),
}));

vi.mock('../../api/items', () => ({
  listItems: vi.fn(),
}));

describe('SaleFormModal', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(authApi.getCurrentBusiness).mockResolvedValue(undefined);
    vi.mocked(itemApi.listItems).mockResolvedValue({
      data: [testItem],
      page: 1,
      pageSize: 100,
      total: 1,
      totalPages: 1,
    });
    vi.mocked(channelApi.listChannels).mockResolvedValue([{ id: 2, name: 'Market' }]);
  });

  it('submits a sale with the selected item, date, and channel', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<SaleFormModal onCancel={vi.fn()} onSubmit={onSubmit} />, { wrapper: PageProviders });

    await user.selectOptions(await screen.findByLabelText(/^Item\b/), '1');
    await user.type(screen.getByLabelText(/^Date\b/), '2026-10-20');
    await user.selectOptions(screen.getByLabelText(/^Channel\b/), '2');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith({
      soldAt: '2026-10-20T00:00:00.000Z',
      channelId: 2,
      description: '',
      tags: [],
      items: [{ itemId: 1, quantity: 1 }],
    });
  });

  describe('editing a sale recorded in another currency', () => {
    // A list row as the API sends it after the account switched from EUR to CAD: the total is
    // converted for display, but the lines stay in euros.
    const euroSale: Sale = {
      id: 7,
      soldAt: '2026-10-20T00:00:00.000Z',
      channel: { id: 2, name: 'Market' },
      description: '',
      tags: [],
      totalCents: 900,
      currency: 'CAD',
      originalAmount: 6,
      originalCurrency: 'EUR',
      items: [
        { id: 1, itemId: 1, itemName: 'Tea', quantity: 2, unitPriceCents: 300, totalCents: 600 },
      ],
      createdAt: '2026-10-20T00:00:00.000Z',
      updatedAt: '2026-10-20T00:00:00.000Z',
    };

    it("shows the lines in the sale's currency, at the prices they were sold for", async () => {
      render(<SaleFormModal sale={euroSale} onCancel={vi.fn()} onSubmit={vi.fn()} />, {
        wrapper: PageProviders,
      });

      // Tea now costs 4.50 CAD, but the server keeps the 3.00 EUR it was sold at.
      // The line total and the grand total.
      await waitFor(() => expect(screen.getAllByText('6.00 EUR')).toHaveLength(2));
      expect(screen.queryByText(/converted when you save/)).not.toBeInTheDocument();
    });

    it('says when an added item will be converted instead of guessing its total', async () => {
      const user = userEvent.setup();
      vi.mocked(itemApi.listItems).mockResolvedValue({
        data: [testItem, { ...testItem, id: 2, name: 'Coffee' }],
        page: 1,
        pageSize: 100,
        total: 2,
        totalPages: 1,
      });
      render(<SaleFormModal sale={euroSale} onCancel={vi.fn()} onSubmit={vi.fn()} />, {
        wrapper: PageProviders,
      });
      await screen.findAllByText('6.00 EUR');

      await user.click(screen.getByRole('button', { name: /Add another item/ }));
      await user.selectOptions(screen.getAllByLabelText(/^Item\b/)[1]!, '2');

      expect(
        screen.getByText(
          'This sale is in EUR, so items priced in another currency are converted when you save.',
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText(/EUR$/)).toHaveTextContent('6.00 EUR');
    });
  });
});
