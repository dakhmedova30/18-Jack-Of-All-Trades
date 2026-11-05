import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authApi from '../../api/auth';
import * as channelApi from '../../api/channels';
import * as itemApi from '../../api/items';
import { testItem } from '../../test/fixtures';
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
});
