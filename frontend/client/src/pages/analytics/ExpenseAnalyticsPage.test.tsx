import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  getExpenseTagsInUse: vi.fn(),
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
  expenseSeries: [],
  byTag: [],
};

/**
 * October made 200.00 and November lost 100.00; restocks are 70% of spending. Spending was
 * 300.00 in October (stock 200.00, rent 100.00) and 200.00 in November.
 */
const TWO_MONTHS: ExpenseTrends = {
  ...NOTHING,
  revenueCents: months({ 10: 50000, 11: 10000 }),
  restockCents: months({ 10: 20000, 11: 15000 }),
  runningCents: months({ 10: 10000, 11: 5000 }),
  expenseSeries: [
    { label: 'stock', values: months({ 10: 20000, 11: 15000 }) },
    { label: 'rent', values: months({ 10: 10000, 11: 5000 }) },
  ],
  byTag: [
    { label: 'stock', valueCents: 35000 },
    { label: 'rent', valueCents: 15000 },
  ],
};

/** TWO_MONTHS narrowed to expenses tagged "stock" first: restocks only. Revenue stays whole. */
const STOCK_ONLY: ExpenseTrends = {
  ...TWO_MONTHS,
  restockCents: months({ 10: 20000, 11: 15000 }),
  runningCents: months({}),
  expenseSeries: [{ label: 'stock', values: months({ 10: 20000, 11: 15000 }) }],
  byTag: [{ label: 'stock', valueCents: 35000 }],
};

/** Records from Aug 1, 2025 to Nov 20, 2026, so the default period is Dec 1, 2025 to Nov 20, 2026. */
const DEFAULT_PERIOD = { from: '2025-12-01', to: '2026-11-20' };

async function findCard(title: string) {
  const heading = await screen.findByRole('heading', { name: title });
  return within(heading.closest('section')!);
}

describe('ExpenseAnalyticsPage charts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(authApi.getCurrentBusiness).mockResolvedValue(undefined);
    vi.mocked(analyticsApi.getExpenseTagsInUse).mockResolvedValue(['rent', 'stock', 'Untagged']);
    vi.mocked(expenseApi.getExpenseMonthBreakdown).mockResolvedValue({
      periodStart: '2026-11-01T00:00:00Z',
      periodEnd: '2026-12-01T00:00:00Z',
      restockCents: 0,
      runningCents: 0,
      totalCents: 0,
      previousTotalCents: 0,
      largestExpense: null,
      topRestockItems: [],
    });
    vi.mocked(analyticsApi.getAnalyticsDateRange).mockResolvedValue({
      firstDate: '2025-08-01',
      lastDate: '2026-11-20',
      today: '2026-11-25',
    });
  });

  it("shows this month's spending, against last month, and its largest expense", async () => {
    vi.mocked(analyticsApi.getExpenseTrends).mockResolvedValue(TWO_MONTHS);
    vi.mocked(expenseApi.getExpenseMonthBreakdown).mockResolvedValue({
      periodStart: '2026-11-01T00:00:00Z',
      periodEnd: '2026-12-01T00:00:00Z',
      restockCents: 13352,
      runningCents: 53408,
      totalCents: 66760,
      previousTotalCents: 50000,
      largestExpense: {
        id: 9,
        incurredAt: '2026-11-03T12:00:00Z',
        description: 'Market stall fee',
        totalCents: 40000,
      },
      topRestockItems: [],
    });
    render(<ExpenseAnalyticsPage />, { wrapper: Providers });

    const spent = await findCard('Spent');
    expect(await spent.findByText('667.60 CAD')).toBeInTheDocument();
    expect(spent.getByText('Already 34% more than October')).toBeInTheDocument();
    const largest = await findCard('Largest expense');
    expect(largest.getByText('400.00 CAD')).toBeInTheDocument();
    expect(largest.getByText(/^Market stall fee · on /)).toBeInTheDocument();
    const split = await findCard('Where the money goes');
    expect(split.getByText('133.52 CAD · 20%')).toBeInTheDocument();
  });

  it('says what last month came to while this month is still under it', async () => {
    vi.mocked(analyticsApi.getExpenseTrends).mockResolvedValue(TWO_MONTHS);
    vi.mocked(expenseApi.getExpenseMonthBreakdown).mockResolvedValue({
      periodStart: '2026-11-01T00:00:00Z',
      periodEnd: '2026-12-01T00:00:00Z',
      restockCents: 0,
      runningCents: 10000,
      totalCents: 10000,
      previousTotalCents: 50000,
      largestExpense: null,
      topRestockItems: [],
    });
    render(<ExpenseAnalyticsPage />, { wrapper: Providers });

    const spent = await findCard('Spent');
    expect(await spent.findByText('500.00 CAD in all of October')).toBeInTheDocument();
    expect((await findCard('Largest expense')).getByText('—')).toBeInTheDocument();
  });

  it('charts expenses by tag, profit, cost types and tags', async () => {
    vi.mocked(analyticsApi.getExpenseTrends).mockResolvedValue(TWO_MONTHS);
    render(<ExpenseAnalyticsPage />, { wrapper: Providers });

    // Expenses only, a line per tag: no revenue line any more.
    const overview = await findCard('Expenses by month');
    expect(overview.getByRole('img', { name: 'Expenses by tag, by month' })).toBeInTheDocument();
    expect(
      overview
        .getAllByRole('listitem')
        .filter((item) => item.closest('.viz-legend'))
        .map((item) => item.textContent),
    ).toEqual(['stock', 'rent']);
    expect(
      overview.getByText(/^Your highest-spending month from .* was Oct 2026, at 300\.00 CAD\.$/),
    ).toBeInTheDocument();
    expect(
      overview.getByRole('row', {
        name: 'Oct 2026 200.00 CAD 100.00 CAD 300.00 CAD',
        hidden: true,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Revenue and expenses' })).not.toBeInTheDocument();

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

  it('shows every month with expenses but no revenue as a loss', async () => {
    vi.mocked(analyticsApi.getExpenseTrends).mockResolvedValue({
      ...TWO_MONTHS,
      revenueCents: months({}),
    });
    render(<ExpenseAnalyticsPage />, { wrapper: Providers });

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
      expect(analyticsApi.getExpenseTrends).toHaveBeenLastCalledWith(DEFAULT_PERIOD, undefined),
    );

    vi.mocked(analyticsApi.getExpenseTrends).mockResolvedValue({
      ...TWO_MONTHS,
      granularity: 'day',
      buckets: ['2026-11-19', '2026-11-20'],
      bucketLabels: ['Nov 19', 'Nov 20'],
      revenueCents: [50000, 10000],
      restockCents: [20000, 15000],
      runningCents: [10000, 5000],
      expenseSeries: [
        { label: 'stock', values: [20000, 15000] },
        { label: 'rent', values: [10000, 5000] },
      ],
    });
    fireEvent.change(within(filters).getByLabelText('Start date', { selector: 'input' }), {
      target: { value: '2026-11-19' },
    });
    await waitFor(() =>
      expect(analyticsApi.getExpenseTrends).toHaveBeenLastCalledWith(
        { from: '2026-11-19', to: '2026-11-20' },
        undefined,
      ),
    );
    const profit = await findCard('Profit by day');
    expect(
      profit.getByText('A profit in 1 day and a loss in 1 day: 100.00 CAD made overall.'),
    ).toBeInTheDocument();
    expect(
      profit.getByRole('row', { name: 'Nov 20, 2026 -100.00 CAD', hidden: true }),
    ).toBeInTheDocument();
  });

  describe('tag filter', () => {
    async function openTags() {
      const filters = await screen.findByRole('complementary', { name: 'Filters' });
      const button = within(filters).getByRole('button', { name: 'Tags All tags' });
      await waitFor(() => expect(button).toBeEnabled());
      await userEvent.click(button);
      return { filters, button };
    }

    it('narrows the charts to the ticked first tags, and Reset unticks them', async () => {
      const user = userEvent.setup();
      vi.mocked(analyticsApi.getExpenseTrends).mockImplementation((_period, tags) =>
        Promise.resolve(tags?.join() === 'stock' ? STOCK_ONLY : TWO_MONTHS),
      );
      render(<ExpenseAnalyticsPage />, { wrapper: Providers });
      expect(await screen.findByRole('heading', { name: 'Profit by month' })).toBeInTheDocument();

      // The tags are the ones expenses have, with "Untagged" as the charts name those without.
      const { filters, button } = await openTags();
      expect(
        within(filters)
          .getAllByRole('checkbox')
          .map((box) => box.parentElement!.textContent),
      ).toEqual(['All tags', 'rent', 'stock', 'Untagged']);

      await user.click(within(filters).getByRole('checkbox', { name: 'stock' }));
      await waitFor(() =>
        expect(analyticsApi.getExpenseTrends).toHaveBeenLastCalledWith(DEFAULT_PERIOD, ['stock']),
      );
      expect(button).toHaveAccessibleName('Tags stock');
      const overview = await findCard('Expenses by month');
      expect(await overview.findByText('"stock" only')).toBeInTheDocument();
      expect(
        (await findCard('Restocks and running costs')).getByText(
          'Restocking is 100% of "stock" spending; running costs are the other 0%.',
        ),
      ).toBeInTheDocument();
      // Some tags' spending against every sale isn't a profit, and one tag has nothing to compare.
      expect(screen.queryByRole('heading', { name: 'Profit by month' })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Spending by tag' })).not.toBeInTheDocument();

      // Two tags: a line each, and compared with each other, but still no profit.
      await user.click(within(filters).getByRole('checkbox', { name: 'rent' }));
      await waitFor(() =>
        expect(analyticsApi.getExpenseTrends).toHaveBeenLastCalledWith(DEFAULT_PERIOD, [
          'rent',
          'stock',
        ]),
      );
      expect(await screen.findByText('One line per chosen tag')).toBeInTheDocument();
      expect(
        (await findCard('Spending by tag')).getByText(
          '"stock" is the biggest of the chosen tags: 70% of their spending.',
        ),
      ).toBeInTheDocument();
      expect(
        (await findCard('Restocks and running costs')).getByText(
          "Restocking is 70% of the chosen tags' spending; running costs are the other 30%.",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Profit by month' })).not.toBeInTheDocument();

      await user.click(within(filters).getByRole('button', { name: 'Reset' }));
      expect(button).toHaveAccessibleName('Tags All tags');
      await waitFor(() =>
        expect(analyticsApi.getExpenseTrends).toHaveBeenLastCalledWith(DEFAULT_PERIOD, undefined),
      );
      expect(await screen.findByRole('heading', { name: 'Profit by month' })).toBeInTheDocument();
    });

    it('names the tags when they had no expenses in the period, even with sales', async () => {
      const user = userEvent.setup();
      vi.mocked(analyticsApi.getExpenseTrends).mockImplementation((_period, tags) =>
        Promise.resolve(tags ? { ...NOTHING, revenueCents: months({ 10: 50000 }) } : TWO_MONTHS),
      );
      render(<ExpenseAnalyticsPage />, { wrapper: Providers });

      const { filters } = await openTags();
      await user.click(within(filters).getByRole('checkbox', { name: 'Untagged' }));
      const card = await findCard('Expense trends');
      expect(
        await card.findByText(/^No \u201cUntagged\u201d expenses from .*other tags/),
      ).toBeInTheDocument();
    });
  });
});
