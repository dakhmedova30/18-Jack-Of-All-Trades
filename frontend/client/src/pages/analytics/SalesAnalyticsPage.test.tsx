import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as analyticsApi from '../../api/analytics';
import * as authApi from '../../api/auth';
import * as channelApi from '../../api/channels';
import * as itemApi from '../../api/items';
import * as saleApi from '../../api/sales';
import { PageProviders } from '../../test/providers';
import type { SalesTrends } from '../../types';
import { SalesAnalyticsPage } from './SalesAnalyticsPage';

vi.mock('../../api/auth', () => ({ getCurrentBusiness: vi.fn() }));
vi.mock('../../api/channels', () => ({ listChannels: vi.fn() }));
vi.mock('../../api/items', () => ({ getInventoryInsights: vi.fn() }));
vi.mock('../../api/sales', () => ({ getSalesMonthSummary: vi.fn() }));
vi.mock('../../api/analytics', () => ({
  getAnalyticsDateRange: vi.fn(),
  getSalesTrends: vi.fn(),
}));

function Providers({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <PageProviders>{children}</PageProviders>
    </MemoryRouter>
  );
}

const BUCKETS = [
  '2025-12',
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04',
  '2026-05',
  '2026-06',
  '2026-07',
  '2026-08',
  '2026-09',
  '2026-10',
  '2026-11',
];
const LABELS = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Records from Aug 1, 2025 to Nov 20, 2026, so the default period is Dec 1, 2025 to Nov 20, 2026. */
const DEFAULT_PERIOD = { from: '2025-12-01', to: '2026-11-20' };

/** Twelve months of zeros, with `values` at the given month indexes. */
function months(values: Record<number, number>): number[] {
  return BUCKETS.map((_, i) => values[i] ?? 0);
}

const NO_SALES: SalesTrends = {
  granularity: 'month',
  buckets: BUCKETS,
  bucketLabels: LABELS,
  revenueCents: months({}),
  channelSeries: [],
  saleCounts: months({}),
  byWeekday: WEEKDAYS.map((day) => ({ day, saleCount: 0, revenueCents: 0 })),
  byChannel: [],
};

/** Four sales in August, two in November; most revenue on Saturdays and online. */
const SOME_SALES: SalesTrends = {
  ...NO_SALES,
  revenueCents: months({ 8: 120000, 11: 30000 }),
  channelSeries: [
    { label: 'Online', values: months({ 8: 90000 }) },
    { label: 'In person', values: months({ 8: 30000, 11: 30000 }) },
  ],
  saleCounts: months({ 8: 4, 11: 2 }),
  byWeekday: WEEKDAYS.map((day) =>
    day === 'Sat'
      ? { day, saleCount: 3, revenueCents: 100000 }
      : day === 'Mon'
        ? { day, saleCount: 3, revenueCents: 50000 }
        : { day, saleCount: 0, revenueCents: 0 },
  ),
  byChannel: [
    { label: 'Online', valueCents: 90000 },
    { label: 'In person', valueCents: 60000 },
  ],
};

/** SOME_SALES narrowed to the Online channel: three sales in August. */
const ONLINE_SALES: SalesTrends = {
  ...NO_SALES,
  revenueCents: months({ 8: 90000 }),
  channelSeries: [{ label: 'Online', values: months({ 8: 90000 }) }],
  saleCounts: months({ 8: 3 }),
  byWeekday: WEEKDAYS.map((day) =>
    day === 'Sat'
      ? { day, saleCount: 3, revenueCents: 90000 }
      : { day, saleCount: 0, revenueCents: 0 },
  ),
  byChannel: [{ label: 'Online', valueCents: 90000 }],
};

async function findCard(title: string) {
  const heading = await screen.findByRole('heading', { name: title });
  return within(heading.closest('section')!);
}

describe('SalesAnalyticsPage charts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(authApi.getCurrentBusiness).mockResolvedValue(undefined);
    vi.mocked(channelApi.listChannels).mockResolvedValue([
      { id: 1, name: 'Online' },
      { id: 2, name: 'In person' },
      { id: 3, name: 'Market' },
    ]);
    vi.mocked(saleApi.getSalesMonthSummary).mockResolvedValue({
      periodStart: '2026-11-01T00:00:00Z',
      periodEnd: '2026-12-01T00:00:00Z',
      saleCount: 0,
      revenueCents: 0,
      averageSaleCents: 0,
      largestSale: null,
    });
    vi.mocked(itemApi.getInventoryInsights).mockResolvedValue({
      stockValueCents: 0,
      totalUnits: 0,
      periodStart: '2026-11-01T00:00:00Z',
      periodEnd: '2026-12-01T00:00:00Z',
      bestSellers: [],
      notSelling: [],
      notSellingValueCents: 0,
    });
    vi.mocked(analyticsApi.getAnalyticsDateRange).mockResolvedValue({
      firstDate: '2025-08-01',
      lastDate: '2026-11-20',
      today: '2026-11-25',
    });
  });

  it('charts revenue, sales, the average sale, busiest days and channels', async () => {
    vi.mocked(analyticsApi.getSalesTrends).mockResolvedValue(SOME_SALES);
    render(<SalesAnalyticsPage />, { wrapper: Providers });

    // A revenue line per channel, with their total in the table.
    const revenue = await findCard('Revenue by month');
    expect(
      revenue.getByText(/^Your best month from .* was Aug 2026, with 1,200\.00 CAD\.$/),
    ).toBeInTheDocument();
    expect(revenue.getByRole('img', { name: 'Revenue by channel, by month' })).toBeInTheDocument();
    expect(revenue.getByText('One line per channel')).toBeInTheDocument();
    expect(
      revenue
        .getAllByRole('listitem')
        .filter((item) => item.closest('.viz-legend'))
        .map((item) => item.textContent),
    ).toEqual(['Online', 'In person']);
    expect(
      revenue.getByRole('row', {
        name: 'Aug 2026 900.00 CAD 300.00 CAD 1,200.00 CAD',
        hidden: true,
      }),
    ).toBeInTheDocument();

    const count = await findCard('Sales by month');
    expect(count.getByText(/^6 sales from .*, about 1 a month\.$/)).toBeInTheDocument();
    expect(count.getByRole('row', { name: 'Aug 2026 4', hidden: true })).toBeInTheDocument();

    const average = await findCard('Average sale by month');
    expect(
      average.getByText(
        /^A sale averages 250\.00 CAD from .*; the highest month was Aug 2026, at 300\.00 CAD\.$/,
      ),
    ).toBeInTheDocument();
    // A month without sales has no average, rather than an average of zero.
    expect(average.getByRole('row', { name: 'Sep 2026 —', hidden: true })).toBeInTheDocument();

    const days = await findCard('Busiest days');
    expect(days.getByText('Saturdays bring in the most revenue: 67% of it.')).toBeInTheDocument();
    expect(
      days.getByRole('row', { name: 'Saturday 3 1,000.00 CAD', hidden: true }),
    ).toBeInTheDocument();

    const channels = await findCard('Revenue by channel');
    expect(channels.getByText('"Online" brings in 60% of your revenue.')).toBeInTheDocument();
    expect(
      channels.getByRole('row', { name: 'Online 900.00 CAD 60%', hidden: true }),
    ).toBeInTheDocument();
  });

  it('names weeks when the server splits a shorter period by week', async () => {
    vi.mocked(analyticsApi.getSalesTrends).mockResolvedValue({
      ...SOME_SALES,
      granularity: 'week',
      buckets: ['2026-10-05', '2026-10-12'],
      bucketLabels: ['Oct 5', 'Oct 12'],
      revenueCents: [10000, 30000],
      channelSeries: [{ label: 'Online', values: [10000, 30000] }],
      saleCounts: [1, 3],
    });
    render(<SalesAnalyticsPage />, { wrapper: Providers });

    const revenue = await findCard('Revenue by week');
    expect(
      revenue.getByText(
        /^Your best week from .* was the week of Oct 12, 2026, with 300\.00 CAD\.$/,
      ),
    ).toBeInTheDocument();
    expect(
      revenue.getByRole('columnheader', { name: 'Week of', hidden: true }),
    ).toBeInTheDocument();
    expect(
      revenue.getByRole('row', { name: 'Oct 5, 2026 100.00 CAD', hidden: true }),
    ).toBeInTheDocument();
    expect(
      (await findCard('Sales by week')).getByText(/^4 sales from .*, about 2 a week\.$/),
    ).toBeInTheDocument();
  });

  it('has one empty state when there were no sales', async () => {
    vi.mocked(analyticsApi.getSalesTrends).mockResolvedValue(NO_SALES);
    render(<SalesAnalyticsPage />, { wrapper: Providers });

    const card = await findCard('Sales trends');
    expect(card.getByText(/^No sales from /)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Busiest days' })).not.toBeInTheDocument();
  });

  describe('date filter', () => {
    it('opens on the main page default period, and reloads for typed dates', async () => {
      vi.mocked(analyticsApi.getSalesTrends).mockResolvedValue(SOME_SALES);
      render(<SalesAnalyticsPage />, { wrapper: Providers });

      // The same filter as the main Analytics page, beside this month's cards.
      const filters = await screen.findByRole('complementary', { name: 'Filters' });
      expect(within(filters).getByRole('button', { name: 'Reset' })).toBeDisabled();
      await waitFor(() =>
        expect(analyticsApi.getSalesTrends).toHaveBeenLastCalledWith(DEFAULT_PERIOD, undefined),
      );

      // A complete, valid start date applies on its own; the charts reload once it settles. (The
      // slider's handle is also labelled "Start date", hence the selector.)
      fireEvent.change(within(filters).getByLabelText('Start date', { selector: 'input' }), {
        target: { value: '2026-10-01' },
      });
      await waitFor(() =>
        expect(analyticsApi.getSalesTrends).toHaveBeenLastCalledWith(
          { from: '2026-10-01', to: '2026-11-20' },
          undefined,
        ),
      );
      expect(within(filters).getByRole('button', { name: 'Reset' })).toBeEnabled();
    });

    it('goes back to the default period on Reset', async () => {
      const user = userEvent.setup();
      vi.mocked(analyticsApi.getSalesTrends).mockResolvedValue(SOME_SALES);
      render(<SalesAnalyticsPage />, { wrapper: Providers });

      const filters = await screen.findByRole('complementary', { name: 'Filters' });
      fireEvent.change(within(filters).getByLabelText('End date', { selector: 'input' }), {
        target: { value: '2026-06-30' },
      });
      await waitFor(() =>
        expect(analyticsApi.getSalesTrends).toHaveBeenLastCalledWith(
          { from: '2025-12-01', to: '2026-06-30' },
          undefined,
        ),
      );

      await user.click(within(filters).getByRole('button', { name: 'Reset' }));
      await waitFor(() =>
        expect(analyticsApi.getSalesTrends).toHaveBeenLastCalledWith(DEFAULT_PERIOD, undefined),
      );
    });

    it('shows a load error with Retry when the record dates fail', async () => {
      const user = userEvent.setup();
      vi.mocked(analyticsApi.getAnalyticsDateRange).mockRejectedValueOnce(new Error('Server down'));
      vi.mocked(analyticsApi.getSalesTrends).mockResolvedValue(SOME_SALES);
      render(<SalesAnalyticsPage />, { wrapper: Providers });

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent("Couldn't load sales trends: Server down");
      await user.click(within(alert).getByRole('button', { name: 'Retry' }));
      expect(await screen.findByRole('heading', { name: 'Revenue by month' })).toBeInTheDocument();
    });
  });

  describe('channel filter', () => {
    async function openChannels() {
      const filters = await screen.findByRole('complementary', { name: 'Filters' });
      const button = within(filters).getByRole('button', { name: 'Channels All channels' });
      await waitFor(() => expect(button).toBeEnabled());
      await userEvent.click(button);
      return { filters, button };
    }

    it('narrows every chart to the ticked channels, and Reset unticks them', async () => {
      const user = userEvent.setup();
      vi.mocked(analyticsApi.getSalesTrends).mockImplementation((_period, ids) =>
        Promise.resolve(ids?.join() === '1' ? ONLINE_SALES : SOME_SALES),
      );
      render(<SalesAnalyticsPage />, { wrapper: Providers });
      expect(
        await screen.findByRole('heading', { name: 'Revenue by channel' }),
      ).toBeInTheDocument();

      const { filters, button } = await openChannels();
      expect(button).toHaveAttribute('aria-expanded', 'true');
      await user.click(within(filters).getByRole('checkbox', { name: 'Online' }));
      await waitFor(() =>
        expect(analyticsApi.getSalesTrends).toHaveBeenLastCalledWith(DEFAULT_PERIOD, [1]),
      );
      expect(button).toHaveAccessibleName('Channels Online');
      // With only some ticked, the tick-all box is half-ticked.
      expect(
        within(filters).getByRole('checkbox', { name: 'All channels' }),
      ).toBePartiallyChecked();
      let revenue = await findCard('Revenue by month');
      expect(await revenue.findByText('Online only')).toBeInTheDocument();
      expect(
        revenue.getByRole('row', { name: 'Aug 2026 900.00 CAD', hidden: true }),
      ).toBeInTheDocument();
      // Comparing channels makes no sense with one.
      expect(screen.queryByRole('heading', { name: 'Revenue by channel' })).not.toBeInTheDocument();

      // Two channels: a line each, and compared with each other.
      await user.click(within(filters).getByRole('checkbox', { name: 'In person' }));
      await waitFor(() =>
        expect(analyticsApi.getSalesTrends).toHaveBeenLastCalledWith(DEFAULT_PERIOD, [1, 2]),
      );
      expect(button).toHaveAccessibleName('Channels Online, In person');
      revenue = await findCard('Revenue by month');
      expect(await revenue.findByText('One line per chosen channel')).toBeInTheDocument();
      expect(
        (await findCard('Revenue by channel')).getByText(
          `"Online" brings in 60% of the chosen channels' revenue.`,
        ),
      ).toBeInTheDocument();

      await user.click(within(filters).getByRole('button', { name: 'Reset' }));
      expect(button).toHaveAccessibleName('Channels All channels');
      await waitFor(() =>
        expect(analyticsApi.getSalesTrends).toHaveBeenLastCalledWith(DEFAULT_PERIOD, undefined),
      );
      expect(await screen.findByText('One line per channel')).toBeInTheDocument();
    });

    it('shows every channel with all of them ticked, as with none', async () => {
      const user = userEvent.setup();
      vi.mocked(analyticsApi.getSalesTrends).mockResolvedValue(SOME_SALES);
      render(<SalesAnalyticsPage />, { wrapper: Providers });

      const { filters, button } = await openChannels();
      const all = within(filters).getByRole('checkbox', { name: 'All channels' });
      await user.click(all);
      for (const name of ['Online', 'In person', 'Market']) {
        expect(within(filters).getByRole('checkbox', { name })).toBeChecked();
      }
      expect(all).toBeChecked();
      expect(button).toHaveAccessibleName('Channels All channels');

      // Unticking one narrows to the other two.
      await user.click(within(filters).getByRole('checkbox', { name: 'Market' }));
      await waitFor(() =>
        expect(analyticsApi.getSalesTrends).toHaveBeenLastCalledWith(DEFAULT_PERIOD, [1, 2]),
      );
      // Ticking it again is every channel: no narrowing at all.
      await user.click(within(filters).getByRole('checkbox', { name: 'Market' }));
      await waitFor(() =>
        expect(analyticsApi.getSalesTrends).toHaveBeenLastCalledWith(DEFAULT_PERIOD, undefined),
      );
      for (const call of vi.mocked(analyticsApi.getSalesTrends).mock.calls) {
        expect(call[1]?.length).not.toBe(3);
      }
    });

    it('closes the menu on Escape, back on its button', async () => {
      const user = userEvent.setup();
      vi.mocked(analyticsApi.getSalesTrends).mockResolvedValue(SOME_SALES);
      render(<SalesAnalyticsPage />, { wrapper: Providers });

      const { filters, button } = await openChannels();
      await user.click(within(filters).getByRole('checkbox', { name: 'Online' }));
      await user.keyboard('{Escape}');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).toHaveFocus();
      expect(within(filters).queryByRole('checkbox', { name: 'Online' })).not.toBeInTheDocument();
    });

    it('names the channels when they had no sales in the period', async () => {
      const user = userEvent.setup();
      vi.mocked(analyticsApi.getSalesTrends).mockImplementation((_period, ids) =>
        Promise.resolve(ids ? NO_SALES : SOME_SALES),
      );
      render(<SalesAnalyticsPage />, { wrapper: Providers });

      const { filters } = await openChannels();
      await user.click(within(filters).getByRole('checkbox', { name: 'In person' }));
      await user.click(within(filters).getByRole('checkbox', { name: 'Market' }));
      const card = await findCard('Sales trends');
      expect(
        await card.findByText(/^No In person or Market sales from .*other channels/),
      ).toBeInTheDocument();
    });
  });
});
