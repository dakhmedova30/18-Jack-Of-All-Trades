import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as analyticsApi from '../../api/analytics';
import * as authApi from '../../api/auth';
import * as channelApi from '../../api/channels';
import { PageProviders } from '../../test/providers';
import type { AnalyticsDateRange, AnalyticsSummary } from '../../types';
import { AnalyticsPage } from './AnalyticsPage';

vi.mock('../../api/analytics', () => ({
  getAnalyticsDateRange: vi.fn(),
  getAnalyticsSummary: vi.fn(),
  getInventoryByTag: vi.fn(),
}));

// Amounts are shown in the account's currency, read through the login provider.
vi.mock('../../api/auth', () => ({
  getCurrentBusiness: vi.fn(),
}));

vi.mock('../../api/channels', () => ({
  listChannels: vi.fn(),
}));

const summary: AnalyticsSummary = {
  totalRevenueCents: 0,
  totalExpensesCents: 0,
  netProfitCents: 0,
  range: 'custom',
  granularity: 'month',
  buckets: ['2026-10'],
  bucketLabels: ['Oct'],
  revenueSeries: [],
  expenseSeries: [],
  salesByTag: [],
  revenueByChannel: [],
};

/** Records from Aug 1, 2025 to Oct 29, 2026, viewed on Nov 5, 2026. */
const dates: AnalyticsDateRange = {
  firstDate: '2025-08-01',
  lastDate: '2026-10-29',
  today: '2026-11-05',
};

/** The page links to the deeper Analytics pages, so it needs a router too. */
function Providers({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <PageProviders>{children}</PageProviders>
    </MemoryRouter>
  );
}

describe('AnalyticsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(authApi.getCurrentBusiness).mockResolvedValue(undefined);
    vi.mocked(analyticsApi.getAnalyticsDateRange).mockResolvedValue(dates);
    vi.mocked(analyticsApi.getAnalyticsSummary).mockResolvedValue(summary);
    vi.mocked(analyticsApi.getInventoryByTag).mockResolvedValue({
      byTag: [],
      totalQuantity: 0,
      totalItems: 0,
    });
    vi.mocked(channelApi.listChannels).mockResolvedValue([
      { id: 2, name: 'Online' },
      { id: 3, name: 'In person' },
    ]);
  });

  it('links to the deeper Inventory, Sales and Expense pages', async () => {
    render(<AnalyticsPage />, { wrapper: Providers });

    const nav = await screen.findByRole('navigation', { name: 'Deeper analytics' });
    expect(within(nav).getAllByRole('link')).toHaveLength(3);
    expect(within(nav).getByRole('link', { name: /^Inventory Analytics/ })).toHaveAttribute(
      'href',
      '/analytics/inventory',
    );
    expect(within(nav).getByRole('link', { name: /^Sales Analytics/ })).toHaveAttribute(
      'href',
      '/analytics/sales',
    );
    expect(within(nav).getByRole('link', { name: /^Expense Analytics/ })).toHaveAttribute(
      'href',
      '/analytics/expenses',
    );
  });

  it('opens on the 12 months up to the latest record', async () => {
    render(<AnalyticsPage />, { wrapper: Providers });

    await waitFor(() =>
      expect(analyticsApi.getAnalyticsSummary).toHaveBeenCalledWith(
        { from: '2025-11-01', to: '2026-10-29' },
        undefined,
      ),
    );
  });

  it('reloads the summary for a typed period and a chosen channel', async () => {
    const user = userEvent.setup();
    render(<AnalyticsPage />, { wrapper: Providers });

    // A complete, valid start date applies on its own; the page reloads once it settles. (The
    // slider's handle is also labelled "Start date", hence the selector.)
    fireEvent.change(await screen.findByLabelText('Start date', { selector: 'input' }), {
      target: { value: '2026-10-01' },
    });
    await waitFor(() =>
      expect(analyticsApi.getAnalyticsSummary).toHaveBeenLastCalledWith(
        { from: '2026-10-01', to: '2026-10-29' },
        undefined,
      ),
    );

    await screen.findByRole('option', { name: 'Online' });
    await user.selectOptions(screen.getByLabelText('Channel'), 'Online');
    await waitFor(() =>
      expect(analyticsApi.getAnalyticsSummary).toHaveBeenLastCalledWith(
        { from: '2026-10-01', to: '2026-10-29' },
        2,
      ),
    );
    // One channel's revenue minus every expense isn't a real profit, so it isn't shown.
    expect(
      await screen.findByText("Not shown for one channel: expenses aren't tied to a channel."),
    ).toBeInTheDocument();
  });

  it('falls back to the 12 months up to today when there are no records yet', async () => {
    vi.mocked(analyticsApi.getAnalyticsDateRange).mockResolvedValue({
      firstDate: null,
      lastDate: null,
      today: '2026-11-05',
    });
    render(<AnalyticsPage />, { wrapper: Providers });

    expect(
      await screen.findByText('The slider appears once you have sales or expenses.'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(analyticsApi.getAnalyticsSummary).toHaveBeenCalledWith(
        { from: '2025-12-01', to: '2026-11-05' },
        undefined,
      ),
    );
  });
});
