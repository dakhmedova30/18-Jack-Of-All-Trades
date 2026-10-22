import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as channelApi from '../../api/channels';
import * as itemApi from '../../api/items';
import type { Item } from '../../types';
import { SaleFormModal } from './SaleFormModal';

vi.mock('../../api/channels', () => ({
  createChannel: vi.fn(),
  listChannels: vi.fn(),
}));

vi.mock('../../api/items', () => ({
  listItems: vi.fn(),
}));

const item: Item = {
  id: 1,
  name: 'Tea',
  quantity: 12,
  unitPriceCents: 450,
  tags: ['Drinks'],
  note: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('SaleFormModal', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(itemApi.listItems).mockResolvedValue({
      data: [item],
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
    render(<SaleFormModal onCancel={vi.fn()} onSubmit={onSubmit} />);

    await user.selectOptions(await screen.findByLabelText('Item'), '1');
    await user.type(screen.getByLabelText('Date'), '2026-10-20');
    await user.selectOptions(screen.getByLabelText('Channel'), '2');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith({
      soldAt: '2026-10-20T00:00:00.000Z',
      channelId: 2,
      description: '',
      tags: [],
      items: [{ itemId: 1, quantity: 1 }],
    });
  });
});
