import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as analyticsApi from '../../api/analytics';
import * as authApi from '../../api/auth';
import * as itemApi from '../../api/items';
import * as saleApi from '../../api/sales';
import { PageProviders } from '../../test/providers';
import type { SalesTrends } from '../../types';
import { SalesAnalyticsPage } from './SalesAnalyticsPage';

vi.mock('../../api/auth', () => ({ getCurrentBusiness: vi.fn() }));
vi.mock('../../api/items', () => ({ getInventoryInsights: vi.fn() }));
vi.mock('../../api/sales', () => ({ getSalesMonthSummary: vi.fn() }));
vi.mock('../../api/analytics', () => ({ getSalesTrends: vi.fn() }));

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

/** Twelve months of zeros, with `values` at the given month indexes. */
function months(values: Record<number, number>): number[] {
  return BUCKETS.map((_, i) => values[i] ?? 0);
}

const NO_SALES: SalesTrends = {
  buckets: BUCKETS,
  bucketLabels: LABELS,
  revenueCents: months({}),
  saleCounts: months({}),
  byWeekday: WEEKDAYS.map((day) => ({ day, saleCount: 0, revenueCents: 0 })),
  byChannel: [],
};

/** Four sales in August, two so far in November; most revenue on Saturdays and online. */
const SOME_SALES: SalesTrends = {
  ...NO_SALES,
  revenueCents: months({ 8: 120000, 11: 30000 }),
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

async function findCard(title: string) {
  const heading = await screen.findByRole('heading', { name: title });
  return within(heading.closest('section')!);
}

describe('SalesAnalyticsPage charts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(authApi.getCurrentBusiness).mockResolvedValue(undefined);
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
    });
  });

  it('charts revenue, sales, the average sale, busiest days and channels', async () => {
    vi.mocked(analyticsApi.getSalesTrends).mockResolvedValue(SOME_SALES);
    render(<SalesAnalyticsPage />, { wrapper: Providers });

    const revenue = await findCard('Revenue by month');
    expect(
      revenue.getByText(
        'Your best month was Aug 2026, with 1,200.00 CAD. Nov 2026 so far: 300.00 CAD.',
      ),
    ).toBeInTheDocument();
    expect(revenue.getByRole('img', { name: 'Revenue by month' })).toBeInTheDocument();

    const count = await findCard('Sales by month');
    expect(count.getByText('6 sales in the last 12 months, about 1 a month.')).toBeInTheDocument();
    expect(count.getByRole('row', { name: 'Aug 2026 4', hidden: true })).toBeInTheDocument();

    const average = await findCard('Average sale by month');
    expect(
      average.getByText(
        'A sale averages 250.00 CAD over the last 12 months; the highest month was Aug 2026, at 300.00 CAD.',
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

  it('says the current month is the best yet when it is', async () => {
    vi.mocked(analyticsApi.getSalesTrends).mockResolvedValue({
      ...SOME_SALES,
      revenueCents: months({ 8: 10000, 11: 30000 }),
    });
    render(<SalesAnalyticsPage />, { wrapper: Providers });

    const revenue = await findCard('Revenue by month');
    expect(
      revenue.getByText('Nov 2026 is your best month yet, with 300.00 CAD so far.'),
    ).toBeInTheDocument();
  });

  it('has one empty state when there were no sales', async () => {
    vi.mocked(analyticsApi.getSalesTrends).mockResolvedValue(NO_SALES);
    render(<SalesAnalyticsPage />, { wrapper: Providers });

    const card = await findCard('Sales trends');
    expect(card.getByText(/No sales in the last 12 months/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Busiest days' })).not.toBeInTheDocument();
  });
});
