import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as analyticsApi from '../../api/analytics';
import * as authApi from '../../api/auth';
import * as expenseApi from '../../api/expenses';
import { PageProviders } from '../../test/providers';
import type { ExpenseTrends } from '../../types';
import { ExpenseAnalyticsPage } from './ExpenseAnalyticsPage';

vi.mock('../../api/auth', () => ({ getCurrentBusiness: vi.fn() }));
vi.mock('../../api/expenses', () => ({ getExpenseMonthBreakdown: vi.fn() }));
vi.mock('../../api/analytics', () => ({
  getAnalyticsDateRange: vi.fn(),
  getExpenseTrends: vi.fn(),
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

function months(values: Record<number, number>): number[] {
  return BUCKETS.map((_, i) => values[i] ?? 0);
}

const NOTHING: ExpenseTrends = {
  granularity: 'month',
  buckets: BUCKETS,
  bucketLabels: BUCKETS.map((key) => key.slice(5)),
  revenueCents: months({}),
  restockCents: months({}),
  runningCents: months({}),
  byTag: [],
};

/** October made 200.00 and November lost 100.00; restocks are 70% of spending. */
const TWO_MONTHS: ExpenseTrends = {
  ...NOTHING,
  revenueCents: months({ 10: 50000, 11: 10000 }),
  restockCents: months({ 10: 20000, 11: 15000 }),
  runningCents: months({ 10: 10000, 11: 5000 }),
  byTag: [
    { label: 'stock', valueCents: 35000 },
    { label: 'rent', valueCents: 15000 },
  ],
};

async function findCard(title: string) {
  const heading = await screen.findByRole('heading', { name: title });
  return within(heading.closest('section')!);
}

describe('ExpenseAnalyticsPage charts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(authApi.getCurrentBusiness).mockResolvedValue(undefined);
    vi.mocked(expenseApi.getExpenseMonthBreakdown).mockResolvedValue({
      periodStart: '2026-11-01T00:00:00Z',
      periodEnd: '2026-12-01T00:00:00Z',
      restockCents: 0,
      runningCents: 0,
      totalCents: 0,
      topRestockItems: [],
    });
    vi.mocked(analyticsApi.getAnalyticsDateRange).mockResolvedValue({
      firstDate: '2025-08-01',
      lastDate: '2026-11-20',
      today: '2026-11-25',
    });
  });

  it('charts revenue against expenses, profit, cost types and tags', async () => {
    vi.mocked(analyticsApi.getExpenseTrends).mockResolvedValue(TWO_MONTHS);
    render(<ExpenseAnalyticsPage />, { wrapper: Providers });

    const overview = await findCard('Revenue and expenses');
    expect(overview.getByText(/^Expenses came to 83% of revenue from .*\.$/)).toBeInTheDocument();
    expect(
      overview.getByRole('row', { name: 'Oct 2026 500.00 CAD 300.00 CAD', hidden: true }),
    ).toBeInTheDocument();

    const profit = await findCard('Profit by month');
    expect(
      profit.getByText('A profit in 1 month and a loss in 1 month: 100.00 CAD made overall.'),
    ).toBeInTheDocument();
    expect(
      profit.getByRole('row', { name: 'Nov 2026 -100.00 CAD', hidden: true }),
    ).toBeInTheDocument();
    expect(profit.getByText('Loss')).toBeInTheDocument();

    const costs = await findCard('Restocks and running costs');
    expect(
      costs.getByText(
        'Restocking is 70% of your spending; running costs such as rent are the other 30%.',
      ),
    ).toBeInTheDocument();

    const tags = await findCard('Spending by tag');
    expect(tags.getByText('"stock" is your biggest cost: 70% of spending.')).toBeInTheDocument();
    expect(
      tags.getByRole('row', { name: 'rent 150.00 CAD 30%', hidden: true }),
    ).toBeInTheDocument();
  });

  it('says when expenses had no revenue to set against', async () => {
    vi.mocked(analyticsApi.getExpenseTrends).mockResolvedValue({
      ...TWO_MONTHS,
      revenueCents: months({}),
    });
    render(<ExpenseAnalyticsPage />, { wrapper: Providers });

    const overview = await findCard('Revenue and expenses');
    expect(
      overview.getByText(/^No revenue from .* to set against 500\.00 CAD of expenses\.$/),
    ).toBeInTheDocument();
    const profit = await findCard('Profit by month');
    expect(
      profit.getByText('A profit in 0 months and a loss in 2 months: 500.00 CAD lost overall.'),
    ).toBeInTheDocument();
  });

  it('has one empty state with no sales or expenses', async () => {
    vi.mocked(analyticsApi.getExpenseTrends).mockResolvedValue(NOTHING);
    render(<ExpenseAnalyticsPage />, { wrapper: Providers });

    const card = await findCard('Costs and profit');
    expect(card.getByText(/^No sales or expenses from /)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Profit by month' })).not.toBeInTheDocument();
  });

  it('loads the default period, then the dates typed into the filter, split by day', async () => {
    vi.mocked(analyticsApi.getExpenseTrends).mockResolvedValue(TWO_MONTHS);
    render(<ExpenseAnalyticsPage />, { wrapper: Providers });

    const filters = await screen.findByRole('complementary', { name: 'Filters' });
    await waitFor(() =>
      expect(analyticsApi.getExpenseTrends).toHaveBeenLastCalledWith({
        from: '2025-12-01',
        to: '2026-11-20',
      }),
    );

    vi.mocked(analyticsApi.getExpenseTrends).mockResolvedValue({
      ...TWO_MONTHS,
      granularity: 'day',
      buckets: ['2026-11-19', '2026-11-20'],
      bucketLabels: ['Nov 19', 'Nov 20'],
      revenueCents: [50000, 10000],
      restockCents: [20000, 15000],
      runningCents: [10000, 5000],
    });
    fireEvent.change(within(filters).getByLabelText('Start date', { selector: 'input' }), {
      target: { value: '2026-11-19' },
    });
    await waitFor(() =>
      expect(analyticsApi.getExpenseTrends).toHaveBeenLastCalledWith({
        from: '2026-11-19',
        to: '2026-11-20',
      }),
    );
    const profit = await findCard('Profit by day');
    expect(
      profit.getByText('A profit in 1 day and a loss in 1 day: 100.00 CAD made overall.'),
    ).toBeInTheDocument();
    expect(
      profit.getByRole('row', { name: 'Nov 20, 2026 -100.00 CAD', hidden: true }),
    ).toBeInTheDocument();
  });
});
