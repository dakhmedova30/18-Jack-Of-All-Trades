import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as analyticsApi from '../../api/analytics';
import * as authApi from '../../api/auth';
import { PageProviders } from '../../test/providers';
import type { AnalyticsDateRange, AnalyticsSummary } from '../../types';
import { AnalyticsPage } from './AnalyticsPage';

vi.mock('../../api/analytics', () => ({
  getAnalyticsDateRange: vi.fn(),
  getAnalyticsSummary: vi.fn(),
}));

// Amounts are shown in the account's currency, read through the login provider.
vi.mock('../../api/auth', () => ({
  getCurrentBusiness: vi.fn(),
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
  expensesByTag: [],
};

/** September and October: revenue in two tags, expenses in two tags. */
const twoMonths: AnalyticsSummary = {
  ...summary,
  totalRevenueCents: 60000,
  totalExpensesCents: 15000,
  netProfitCents: 45000,
  buckets: ['2026-09', '2026-10'],
  bucketLabels: ['Sep', 'Oct'],
  revenueSeries: [
    { label: 'prints', values: [10000, 30000] },
    { label: 'Other', values: [5000, 15000] },
  ],
  expenseSeries: [
    { label: 'rent', values: [5000, 5000] },
    { label: 'supplies', values: [0, 5000] },
  ],
  revenueByChannel: [
    { label: 'Online', valueCents: 45000 },
    { label: 'In person', valueCents: 15000 },
  ],
  expensesByTag: [
    { label: 'rent', valueCents: 10000 },
    { label: 'supplies', valueCents: 5000 },
  ],
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

async function findCard(title: string) {
  const heading = await screen.findByRole('heading', { name: title });
  return within(heading.closest('.card') as HTMLElement);
}

describe('AnalyticsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(authApi.getCurrentBusiness).mockResolvedValue(undefined);
    vi.mocked(analyticsApi.getAnalyticsDateRange).mockResolvedValue(dates);
    vi.mocked(analyticsApi.getAnalyticsSummary).mockResolvedValue(summary);
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

  it('filters by date only, and reloads the summary for a typed period', async () => {
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
    expect(screen.queryByLabelText('Channel')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sales channel' })).not.toBeInTheDocument();
  });

  it('charts total revenue and total expenses as two lines on one chart', async () => {
    vi.mocked(analyticsApi.getAnalyticsSummary).mockResolvedValue(twoMonths);
    render(<AnalyticsPage />, { wrapper: Providers });

    const chart = await findCard('Revenue & Expenses Overview');
    expect(
      chart.getByRole('img', { name: 'Total revenue and total expenses' }),
    ).toBeInTheDocument();
    expect(chart.getByText('Total Revenue')).toBeInTheDocument();
    expect(chart.getByText('Total Expenses')).toBeInTheDocument();
    // Each month's lines are the sums of its tags.
    expect(
      chart.getByRole('row', { name: 'Sep 150.00 CAD 50.00 CAD', hidden: true }),
    ).toBeInTheDocument();
    expect(
      chart.getByRole('row', { name: 'Oct 450.00 CAD 100.00 CAD', hidden: true }),
    ).toBeInTheDocument();
    expect(chart.getByText(/^Expenses came to 25% of revenue from /)).toBeInTheDocument();

    // The separate overviews and the bottom two cards are gone.
    for (const removed of [
      'Revenue Overview',
      'Expenses Overview',
      'Revenue & Expense Breakdown',
      'Inventory Overview',
    ]) {
      expect(screen.queryByRole('heading', { name: removed })).not.toBeInTheDocument();
    }
  });

  it('shows revenue by channel, then expenses by tag, under the filters', async () => {
    vi.mocked(analyticsApi.getAnalyticsSummary).mockResolvedValue(twoMonths);
    render(<AnalyticsPage />, { wrapper: Providers });

    // The card shows "Loading channels…" until the summary arrives, so wait for its bars.
    const revenue = await findCard('Revenue by Channel');
    expect(
      await revenue.findByRole('list', { name: 'Revenue by sales channel' }),
    ).toBeInTheDocument();
    expect(
      revenue.getByText(/^"Online" brings in the most revenue .* \(75%\)\.$/),
    ).toBeInTheDocument();

    const expenses = await findCard('Expenses by Tag');
    const list = expenses.getByRole('list', { name: 'Expenses by tag' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['rent$100', 'supplies$50']);
    expect(expenses.getByText(/^"rent" is your biggest expense .* \(67%\)\.$/)).toBeInTheDocument();

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings.indexOf('Filters')).toBeLessThan(headings.indexOf('Revenue by Channel'));
    expect(headings.indexOf('Revenue by Channel')).toBeLessThan(
      headings.indexOf('Expenses by Tag'),
    );
  });

  it('says so when the period has no sales or expenses', async () => {
    render(<AnalyticsPage />, { wrapper: Providers });

    // One line each, without an insight repeating it.
    const chart = await findCard('Revenue & Expenses Overview');
    expect(chart.getByText(/^No sales or expenses from /)).toBeInTheDocument();
    expect((await findCard('Revenue by Channel')).getByText(/^No sales from /)).toBeInTheDocument();
    expect((await findCard('Expenses by Tag')).getByText(/^No expenses from /)).toBeInTheDocument();
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
