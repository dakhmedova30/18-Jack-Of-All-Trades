import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as channelApi from '../../api/channels';
import * as discountApi from '../../api/discounts';
import * as itemApi from '../../api/items';
import type { Discount, Item } from '../../types';
import { formatCents } from '../../utils/money';
import { MarketSaleFormModal } from './MarketSaleFormModal';

vi.mock('../../api/channels', () => ({ listChannels: vi.fn() }));
vi.mock('../../api/discounts', () => ({ listDiscounts: vi.fn() }));
vi.mock('../../api/items', () => ({ listItems: vi.fn() }));

const item: Item = {
  id: 1,
  name: 'Print',
  quantity: 3,
  unitPriceCents: 500,
  currency: 'CAD',
  originalPrice: 5,
  originalCurrency: 'CAD',
  tags: [],
  note: '',
  isPublic: false,
  width: null,
  height: null,
  sizeUnit: null,
  amountSold: 0,
  isActive: true,
  createdAt: '2026-10-18T00:00:00.000Z',
  updatedAt: '2026-10-18T00:00:00.000Z',
};

const discount: Discount = {
  id: 2,
  name: 'Dollar discount',
  appliesTo: null,
  kind: 'SOLID',
  isCharge: false,
  valueType: 'AMOUNT',
  value: 1,
  buyCount: null,
  getCount: null,
  tiers: [],
  currency: 'CAD',
  createdAt: '2026-10-18T00:00:00.000Z',
  updatedAt: '2026-10-18T00:00:00.000Z',
};

describe('MarketSaleFormModal', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(channelApi.listChannels).mockResolvedValue([{ id: 1, name: 'Misc' }]);
    vi.mocked(discountApi.listDiscounts).mockResolvedValue([discount]);
    vi.mocked(itemApi.listItems).mockResolvedValue({
      data: [item],
      page: 1,
      pageSize: 100,
      total: 1,
      totalPages: 1,
    });
  });

  it('updates the total for discounts, free items, tips, and one-time items', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <MarketSaleFormModal
        target={{
          marketId: null,
          commissionId: null,
          miscId: 7,
          channelName: 'Misc',
          title: 'Add sale',
          currency: 'CAD',
          defaultDate: '2026-10-18',
        }}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.selectOptions(await screen.findByRole('combobox', { name: /^Item 1\b/ }), '1');
    await user.click(screen.getByLabelText('Dollar discount'));
    await user.type(screen.getByLabelText('Tip (CAD)'), '1');
    await waitFor(() => expect(screen.getByText(formatCents(500, 'CAD'))).toBeInTheDocument());

    await user.click(screen.getByLabelText('Free?'));
    await waitFor(() => expect(screen.getByText(formatCents(100, 'CAD'))).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Add item/ }));
    await user.selectOptions(await screen.findByRole('combobox', { name: /^Item 2\b/ }), 'custom');
    await user.type(screen.getByLabelText('Item 2 name'), 'Bookmark');
    await user.type(screen.getByLabelText('Item 2 change price'), '2.50');
    await waitFor(() => expect(screen.getByText(formatCents(250, 'CAD'))).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        miscId: 7,
        tipCents: 100,
        items: [
          expect.objectContaining({ itemId: 1, isFree: true }),
          expect.objectContaining({
            itemId: null,
            itemName: 'Bookmark',
            quantity: 1,
            unitPriceCents: 250,
          }),
        ],
      }),
    );
  });
});
