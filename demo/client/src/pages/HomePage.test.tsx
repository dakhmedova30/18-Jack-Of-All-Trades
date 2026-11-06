import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as analyticsApi from '../api/analytics';
import * as authApi from '../api/auth';
import * as itemApi from '../api/items';
import * as salesApi from '../api/sales';
import { PageProviders } from '../test/providers';
import type { AnalyticsRange, AnalyticsSummary } from '../types';
import { HomePage } from './HomePage';

vi.mock('../api/analytics', () => ({ getAnalyticsSummary: vi.fn() }));
vi.mock('../api/auth', () => ({ getCurrentBusiness: vi.fn() }));
vi.mock('../api/items', () => ({ listItems: vi.fn(), getLowStock: vi.fn() }));
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
  };
}

function renderHome() {
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
    { wrapper: PageProviders },
  );
}

const rangeSelect = () => screen.getByLabelText('Show');

describe('HomePage period', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    vi.mocked(authApi.getCurrentBusiness).mockResolvedValue(undefined);
    vi.mocked(itemApi.listItems).mockResolvedValue({
      data: [],
      page: 1,
      pageSize: 1,
      total: 0,
      totalPages: 0,
    });
    vi.mocked(itemApi.getLowStock).mockResolvedValue({ count: 0, threshold: 5, items: [] });
    vi.mocked(salesApi.listSales).mockResolvedValue({
      data: [],
      page: 1,
      pageSize: 5,
      total: 0,
      totalPages: 0,
    });
    vi.mocked(analyticsApi.getAnalyticsSummary).mockImplementation(async (range) =>
      summaryFor(range as AnalyticsRange),
    );
  });

  it('shows this month by default', async () => {
    renderHome();

    expect(rangeSelect()).toHaveValue('month');
    await waitFor(() =>
      expect(analyticsApi.getAnalyticsSummary).toHaveBeenCalledWith('month', undefined),
    );
    expect(screen.getByText('Revenue · this month')).toBeInTheDocument();
  });

  it('explains an empty period instead of only showing zeros', async () => {
    renderHome();

    // On the Revenue tile and in the Sales card.
    expect(await screen.findAllByText('No sales yet this month')).toHaveLength(2);
    expect(screen.getAllByText('No expenses yet this month')).toHaveLength(2);
    expect(screen.getByText('Nothing recorded yet this month')).toBeInTheDocument();
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
    expect(screen.getByText('Monthly revenue, last 12 months')).toBeInTheDocument();
    expect(screen.getByText('Top expense categories, last 12 months')).toBeInTheDocument();
    expect(localStorage.getItem('jat:home-range')).toBe('12months');
  });

  it('opens on the period chosen last time', async () => {
    localStorage.setItem('jat:home-range', 'week');
    renderHome();

    expect(rangeSelect()).toHaveValue('week');
    await waitFor(() =>
      expect(analyticsApi.getAnalyticsSummary).toHaveBeenCalledWith('week', undefined),
    );
    expect(await screen.findByText('Daily revenue, last 7 days')).toBeInTheDocument();
    expect(screen.getAllByText('No sales in the last 7 days')).toHaveLength(2);
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
