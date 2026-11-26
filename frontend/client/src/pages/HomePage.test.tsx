import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as analyticsApi from '../api/analytics';
import * as authApi from '../api/auth';
import * as expensesApi from '../api/expenses';
import * as itemApi from '../api/items';
import * as salesApi from '../api/sales';
import { testBusiness } from '../test/fixtures';
import { PageProviders } from '../test/providers';
import type { AnalyticsRange, AnalyticsSummary, Expense, InventoryInsights, Sale } from '../types';
import { addDays } from '../utils/date';
import { HomePage } from './HomePage';
import { worstSeller } from './HomeCardPreviews';

vi.mock('../api/analytics', () => ({ getAnalyticsSummary: vi.fn() }));
vi.mock('../api/auth', () => ({ getCurrentBusiness: vi.fn() }));
vi.mock('../api/expenses', () => ({ listExpenses: vi.fn() }));
vi.mock('../api/items', () => ({
  listItems: vi.fn(),
  getLowStock: vi.fn(),
  getInventoryInsights: vi.fn(),
}));
vi.mock('../api/sales', () => ({ listSales: vi.fn() }));

/** A summary for `range`: monthly buckets for the year-long ranges, daily otherwise. */
function summaryFor(range: AnalyticsRange, revenueCents = 0, expensesCents = 0): AnalyticsSummary {
  const monthly = range === 'ytd' || range === '12months';
  return {
    range,
    granularity: monthly ? 'month' : 'day',
    buckets: monthly ? ['2026-10', '2026-11'] : ['2026-11-04', '2026-11-05'],
    bucketLabels: monthly ? ['Oct', 'Nov'] : ['4', '5'],
    totalRevenueCents: revenueCents,
    totalExpensesCents: expensesCents,
    netProfitCents: revenueCents - expensesCents,
    revenueSeries: revenueCents ? [{ label: 'print', values: [0, revenueCents] }] : [],
    expenseSeries: expensesCents ? [{ label: 'market', values: [expensesCents, 0] }] : [],
    salesByTag: [],
    revenueByChannel: [],
    expensesByTag: [],
  };
}

function insights(overrides: Partial<InventoryInsights> = {}): InventoryInsights {
  return {
    stockValueCents: 0,
    totalUnits: 0,
    periodStart: '2026-11-01T00:00:00Z',
    periodEnd: '2026-12-01T00:00:00Z',
    bestSellers: [],
    worstSeller: null,
    notSelling: [],
    notSellingValueCents: 0,
    ...overrides,
  };
}

function page<T>(data: T[]) {
  return { data, page: 1, pageSize: 4, total: data.length, totalPages: 1 };
}

const sale = (id: number, soldAt: string, itemName: string, totalCents: number): Sale => ({
  id,
  soldAt,
  channel: null,
  description: '',
  tags: [],
  totalCents,
  currency: 'CAD',
  originalAmount: totalCents / 100,
  originalCurrency: 'CAD',
  items: [{
    id,
    itemId: 1,
    itemName,
    quantity: 1,
    unitPriceCents: totalCents,
    totalCents,
    kind: 'ITEM',
    isFree: false,
    isTrade: false,
    discountId: null,
  }],
  marketId: null,
  commissionId: null,
  miscId: null,
  createdAt: soldAt,
  updatedAt: soldAt,
});

const expense = (id: number, incurredAt: string, description: string, totalCents: number) =>
  ({
    id,
    incurredAt,
    description,
    tags: [],
    totalCents,
    currency: 'CAD',
    originalAmount: totalCents / 100,
    originalCurrency: 'CAD',
    items: [],
    createdAt: incurredAt,
    updatedAt: incurredAt,
  }) satisfies Expense;

function renderHome() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
    { wrapper: PageProviders },
  );
}

const rangeSelect = () => screen.getByLabelText('Show');
const card = (title: string) => screen.getByRole('link', { name: new RegExp(`^${title}`) });

/** Every request answers with an empty account; tests override what they care about. */
function mockEmptyAccount() {
  vi.resetAllMocks();
  localStorage.clear();
  vi.mocked(authApi.getCurrentBusiness).mockResolvedValue(undefined);
  vi.mocked(itemApi.listItems).mockResolvedValue({ ...page([]), total: 0 });
  vi.mocked(itemApi.getLowStock).mockResolvedValue({ count: 0, threshold: 5, items: [] });
  vi.mocked(itemApi.getInventoryInsights).mockResolvedValue(insights());
  vi.mocked(salesApi.listSales).mockResolvedValue(page([]));
  vi.mocked(expensesApi.listExpenses).mockResolvedValue(page([]));
  vi.mocked(analyticsApi.getAnalyticsSummary).mockImplementation(async (range) =>
    summaryFor(range as AnalyticsRange),
  );
}

describe('HomePage period', () => {
  beforeEach(mockEmptyAccount);

  it('shows this month by default', async () => {
    renderHome();

    expect(rangeSelect()).toHaveValue('month');
    await waitFor(() =>
      expect(analyticsApi.getAnalyticsSummary).toHaveBeenCalledWith('month', undefined),
    );
    expect(screen.getByText('Revenue · this month')).toBeInTheDocument();
  });

  it('explains an empty account instead of only showing zeros', async () => {
    renderHome();

    expect(await screen.findByText('No sales yet this month')).toBeInTheDocument();
    expect(
      await within(card('Analytics')).findByText('No sales in the last 14 days'),
    ).toBeInTheDocument();
    expect(screen.getByText('No expenses yet this month')).toBeInTheDocument();
    expect(await screen.findByText('No sales recorded yet')).toBeInTheDocument();
    expect(screen.getByText('No expenses recorded yet')).toBeInTheDocument();
    expect(screen.getByText('No products yet')).toBeInTheDocument();
    expect(screen.getAllByText('0.00 CAD').length).toBeGreaterThan(0);
  });

  it('reloads for a chosen period, relabels everything, and remembers it', async () => {
    const user = userEvent.setup();
    vi.mocked(analyticsApi.getAnalyticsSummary).mockImplementation(async (range) =>
      summaryFor(range as AnalyticsRange, 120000, 45000),
    );
    renderHome();
    await screen.findByText('Revenue · this month');

    await user.selectOptions(rangeSelect(), 'Last 12 months');

    await waitFor(() =>
      expect(analyticsApi.getAnalyticsSummary).toHaveBeenLastCalledWith('12months', undefined),
    );
    expect(await screen.findByText('Revenue · last 12 months')).toBeInTheDocument();
    expect(screen.getByText('Net Profit · last 12 months')).toBeInTheDocument();
    // The Analytics card always shows the last two weeks, whatever the period.
    expect(within(card('Analytics')).getByText('Last 14 days')).toBeInTheDocument();
    expect(
      within(card('Analytics')).getByRole('img', { name: 'Revenue overview, last 14 days' }),
    ).toBeInTheDocument();
    expect(localStorage.getItem('jat:home-range')).toBe('12months');
  });

  it('opens on the period chosen last time', async () => {
    localStorage.setItem('jat:home-range', 'week');
    renderHome();

    expect(rangeSelect()).toHaveValue('week');
    await waitFor(() =>
      expect(analyticsApi.getAnalyticsSummary).toHaveBeenCalledWith('week', undefined),
    );
    expect(await screen.findByText('No sales in the last 7 days')).toBeInTheDocument();
  });

  it('falls back to this month if the saved choice is unknown', async () => {
    localStorage.setItem('jat:home-range', 'forever');
    renderHome();

    expect(rangeSelect()).toHaveValue('month');
    await waitFor(() =>
      expect(analyticsApi.getAnalyticsSummary).toHaveBeenCalledWith('month', undefined),
    );
  });
});

describe('HomePage greeting and cards', () => {
  beforeEach(mockEmptyAccount);

  it("welcomes the business by name, and says just 'Welcome back' without one", async () => {
    vi.mocked(authApi.getCurrentBusiness).mockResolvedValue({ ...testBusiness, name: 'Acme' });
    const { unmount } = renderHome();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Welcome back, Acme' }),
    ).toBeInTheDocument();
    unmount();

    vi.mocked(authApi.getCurrentBusiness).mockResolvedValue(undefined);
    renderHome();
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeInTheDocument();
  });

  it('has no separate recent sales table, only the four cards', async () => {
    renderHome();
    await screen.findByText('No sales recorded yet');

    expect(screen.queryByRole('heading', { name: 'Recent sales' })).not.toBeInTheDocument();
    for (const title of ['Sales', 'Inventory', 'Expenses', 'Analytics']) {
      expect(card(title)).toBeInTheDocument();
    }
  });

  it('lists the latest sales and expenses with their amounts', async () => {
    vi.mocked(salesApi.listSales).mockResolvedValue(
      page([
        sale(2, '2026-11-20T00:00:00Z', 'Candle', 2500),
        sale(1, '2026-11-18T00:00:00Z', 'Soap', 800),
      ]),
    );
    vi.mocked(expensesApi.listExpenses).mockResolvedValue(
      page([expense(5, '2026-11-19T00:00:00Z', 'Market stall fee', 4000)]),
    );
    renderHome();

    const sales = card('Sales');
    expect(await within(sales).findByText('Candle')).toBeInTheDocument();
    expect(within(sales).getByText('+25.00 CAD')).toBeInTheDocument();
    expect(within(sales).getByText('Soap')).toBeInTheDocument();
    expect(within(sales).getByText('Nov 20, 2026')).toBeInTheDocument();

    const expenses = card('Expenses');
    expect(await within(expenses).findByText('Market stall fee')).toBeInTheDocument();
    expect(within(expenses).getByText('−40.00 CAD')).toBeInTheDocument();
    expect(salesApi.listSales).toHaveBeenCalledWith({ page: 1, pageSize: 6 });
    expect(expensesApi.listExpenses).toHaveBeenCalledWith({ page: 1, pageSize: 6 });
  });

  it("shows this month's best seller in green and worst seller in red", async () => {
    vi.mocked(itemApi.listItems).mockResolvedValue({ ...page([]), total: 6 });
    vi.mocked(itemApi.getInventoryInsights).mockResolvedValue(
      insights({
        bestSellers: [{ id: 1, name: 'Candle', unitsSold: 12, revenueCents: 30000 }],
        worstSeller: { id: 3, name: 'Keychain', unitsSold: 1, revenueCents: 500 },
      }),
    );
    renderHome();

    const inventory = card('Inventory');
    const best = (await within(inventory).findByText('Best seller')).parentElement!;
    expect(best).toHaveClass('home-seller--best');
    expect(within(best).getByText('Candle')).toBeInTheDocument();
    expect(within(best).getByText('12 sold')).toBeInTheDocument();

    const worst = within(inventory).getByText('Worst seller').parentElement!;
    expect(worst).toHaveClass('home-seller--worst');
    expect(within(worst).getByText('Keychain')).toBeInTheDocument();
    expect(within(worst).getByText('1 sold')).toBeInTheDocument();
    expect(await within(inventory).findByText('6 products in inventory')).toBeInTheDocument();
    expect(within(inventory).getByText('Last 30 days')).toBeInTheDocument();
    expect(itemApi.getInventoryInsights).toHaveBeenCalledWith(30);
  });

  it('shows the revenue overview chart on the Analytics card, with axis titles and a legend', async () => {
    vi.mocked(analyticsApi.getAnalyticsSummary).mockResolvedValue(summaryFor('month', 50000));
    renderHome();

    const analytics = card('Analytics');
    expect(
      await within(analytics).findByRole('img', { name: 'Revenue overview, last 14 days' }),
    ).toBeInTheDocument();
    expect(within(analytics).getByText('Last 14 days')).toBeInTheDocument();
    // Its own request: the 14 whole days ending today.
    const today = new Date().toISOString().slice(0, 10);
    expect(analyticsApi.getAnalyticsSummary).toHaveBeenCalledWith(
      { from: addDays(today, -13), to: today },
      undefined,
    );
    expect(within(analytics).getByText('Revenue (CAD)')).toBeInTheDocument();
    expect(within(analytics).getByText('Day')).toBeInTheDocument();
    expect(within(analytics).getByText('Category')).toBeInTheDocument();
    expect(within(analytics).getByText('print')).toBeInTheDocument();
  });

  it('says at the top right of each card what period it covers', async () => {
    renderHome();
    await screen.findByText('No sales recorded yet');

    expect(within(card('Sales')).getByText('Most recent')).toBeInTheDocument();
    expect(within(card('Inventory')).getByText('Last 30 days')).toBeInTheDocument();
    expect(within(card('Expenses')).getByText('Most recent')).toBeInTheDocument();
    expect(within(card('Analytics')).getByText('Last 14 days')).toBeInTheDocument();
  });
});

describe('worstSeller', () => {
  it('prefers an in-stock item that sold nothing, the one with the most stock first', () => {
    expect(
      worstSeller(
        insights({
          worstSeller: { id: 3, name: 'Keychain', unitsSold: 1, revenueCents: 500 },
          notSelling: [
            { id: 4, name: 'Mug', quantity: 2 },
            { id: 5, name: 'Tote', quantity: 9 },
          ],
        }),
      ),
    ).toEqual({ name: 'Tote', detail: '0 sold · 9 in stock' });
  });

  it('is empty when the only item that sold is also the best seller', () => {
    const candle = { id: 1, name: 'Candle', unitsSold: 3, revenueCents: 900 };
    expect(worstSeller(insights({ bestSellers: [candle], worstSeller: candle }))).toBeNull();
  });
});

describe('HomePage revenue after a new sale', () => {
  beforeEach(mockEmptyAccount);

  /** The value shown on the Revenue tile. */
  async function revenueTileValue(): Promise<string | null> {
    const label = await screen.findByText('Revenue · this month');
    return label.parentElement?.querySelector('.stat-card__value')?.textContent ?? null;
  }

  it('shows the new overall revenue total when the dashboard is opened after a sale', async () => {
    // $500 of sales so far this month.
    vi.mocked(analyticsApi.getAnalyticsSummary).mockResolvedValue(
      summaryFor('month', 50000, 20000),
    );
    const { unmount } = renderHome();
    await waitFor(async () => expect(await revenueTileValue()).toBe('500.00 CAD'));
    unmount();

    // A $25 sale is recorded on the Sales page, then the user comes back to the dashboard.
    vi.mocked(analyticsApi.getAnalyticsSummary).mockResolvedValue(
      summaryFor('month', 52500, 20000),
    );
    renderHome();

    await waitFor(async () => expect(await revenueTileValue()).toBe('525.00 CAD'));
    // The month's summary was asked for again, not reused from the first visit.
    const monthCalls = vi
      .mocked(analyticsApi.getAnalyticsSummary)
      .mock.calls.filter(([query]) => query === 'month');
    expect(monthCalls).toHaveLength(2);
  });
});
