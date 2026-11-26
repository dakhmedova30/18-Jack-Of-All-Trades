import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as analyticsApi from '../../api/analytics';
import * as authApi from '../../api/auth';
import * as itemApi from '../../api/items';
import { PageProviders } from '../../test/providers';
import type { InventoryInsights, StockHealth } from '../../types';
import { InventoryAnalyticsPage } from './InventoryAnalyticsPage';

vi.mock('../../api/auth', () => ({
  getCurrentBusiness: vi.fn(),
}));

vi.mock('../../api/items', () => ({
  getInventoryInsights: vi.fn(),
  getLowStock: vi.fn(),
}));

vi.mock('../../api/analytics', () => ({
  getStockHealth: vi.fn(),
}));

const NO_STOCK: StockHealth = {
  lowStockThreshold: 5,
  outOfStockCount: 0,
  lowStockCount: 0,
  wellStockedCount: 0,
  valueByTag: [],
  paceDays: 30,
  runningOut: [],
};

const SOME_STOCK: StockHealth = {
  lowStockThreshold: 5,
  outOfStockCount: 1,
  lowStockCount: 2,
  wellStockedCount: 7,
  valueByTag: [
    { label: 'bath', valueCents: 40000, quantity: 50, itemCount: 2 },
    { label: 'home', valueCents: 10000, quantity: 5, itemCount: 1 },
  ],
  paceDays: 30,
  runningOut: [
    { id: 1, name: 'Mug', quantity: 0, unitsSold: 6, daysLeft: 0 },
    { id: 2, name: 'Soap', quantity: 40, unitsSold: 60, daysLeft: 20 },
  ],
};

/** The page links back to Analytics, so it needs a router too. */
function Providers({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <PageProviders>{children}</PageProviders>
    </MemoryRouter>
  );
}

function mockInsights(notSelling: InventoryInsights['notSelling'], notSellingValueCents = 0) {
  vi.mocked(itemApi.getInventoryInsights).mockResolvedValue({
    stockValueCents: 5400,
    totalUnits: 12,
    periodStart: '2026-10-01',
    periodEnd: '2026-11-01',
    bestSellers: [],
    notSelling,
    notSellingValueCents,
  });
}

async function findPanel(title: string) {
  const heading = await screen.findByRole('heading', { name: title });
  return within(heading.closest('section')!);
}

describe('InventoryAnalyticsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(authApi.getCurrentBusiness).mockResolvedValue(undefined);
    vi.mocked(itemApi.getLowStock).mockResolvedValue({ count: 0, threshold: 5, items: [] });
    vi.mocked(analyticsApi.getStockHealth).mockResolvedValue(NO_STOCK);
    mockInsights([]);
  });

  describe('charts', () => {
    it('shows stock levels, value by tag and what runs out first', async () => {
      const user = userEvent.setup();
      vi.mocked(analyticsApi.getStockHealth).mockResolvedValue(SOME_STOCK);
      render(<InventoryAnalyticsPage />, { wrapper: Providers });

      const levels = await findPanel('Stock levels');
      expect(levels.getByText('10 products')).toBeInTheDocument();
      expect(levels.getByText('Low (5 or fewer)')).toBeInTheDocument();
      expect(
        levels.getByText(
          '3 of your 10 products need restocking: 1 out of stock and 2 running low.',
        ),
      ).toBeInTheDocument();

      const value = await findPanel('Stock value by tag');
      expect(
        value.getByText('"bath" holds 80% of your stock value (400.00 CAD).'),
      ).toBeInTheDocument();
      // The numbers behind each chart sit in a closed table until it's opened.
      await user.click(value.getByText('Show as a table'));
      const valueTable = value.getByRole('table');
      expect(within(valueTable).getByRole('row', { name: 'bath 400.00 CAD 50 2' })).toBeVisible();

      const runningOut = await findPanel('Days of stock left');
      expect(runningOut.getByText("At the last 30 days' pace")).toBeInTheDocument();
      expect(
        runningOut.getByText(
          '"Mug" is out of stock but sold 6 in the last 30 days: restock it first.',
        ),
      ).toBeInTheDocument();
      const runningOutTable = runningOut.getByRole('table', { hidden: true });
      expect(
        within(runningOutTable).getByRole('row', { name: 'Mug 0 6 Out of stock', hidden: true }),
      ).toBeInTheDocument();
      expect(
        within(runningOutTable).getByRole('row', { name: 'Soap 40 60 20 days', hidden: true }),
      ).toBeInTheDocument();
    });

    it('says when everything is well stocked and nothing sold lately', async () => {
      vi.mocked(analyticsApi.getStockHealth).mockResolvedValue({
        ...NO_STOCK,
        wellStockedCount: 4,
        valueByTag: [{ label: 'bath', valueCents: 2000, quantity: 20, itemCount: 4 }],
      });
      render(<InventoryAnalyticsPage />, { wrapper: Providers });

      const levels = await findPanel('Stock levels');
      expect(levels.getByText('Everything is well stocked.')).toBeInTheDocument();
      const runningOut = await findPanel('Days of stock left');
      expect(runningOut.getByText('No sales in the last 30 days.')).toBeInTheDocument();
    });

    it('leaves out a stock level that has no products', async () => {
      vi.mocked(analyticsApi.getStockHealth).mockResolvedValue({
        ...SOME_STOCK,
        outOfStockCount: 0,
      });
      render(<InventoryAnalyticsPage />, { wrapper: Providers });

      const levels = await findPanel('Stock levels');
      expect(
        levels.getByText('2 of your 9 products need restocking: 2 running low.'),
      ).toBeInTheDocument();
    });

    it('has one empty state when there are no products', async () => {
      render(<InventoryAnalyticsPage />, { wrapper: Providers });

      const levels = await findPanel('Stock levels');
      expect(levels.getByText(/No products in inventory yet/)).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Days of stock left' })).not.toBeInTheDocument();
    });

    it('shows a load error with Retry', async () => {
      const user = userEvent.setup();
      vi.mocked(analyticsApi.getStockHealth).mockRejectedValueOnce(new Error('Server down'));
      render(<InventoryAnalyticsPage />, { wrapper: Providers });

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent("Couldn't load stock health: Server down");
      await user.click(within(alert).getByRole('button', { name: 'Retry' }));
      expect(await screen.findByRole('heading', { name: 'Stock levels' })).toBeInTheDocument();
      expect(analyticsApi.getStockHealth).toHaveBeenCalledTimes(2);
    });
  });

  it('shows stock value and low stock', async () => {
    render(<InventoryAnalyticsPage />, { wrapper: Providers });

    expect(await screen.findByRole('heading', { name: 'Inventory Analytics' })).toBeInTheDocument();
    const stockValue = await findPanel('Stock value');
    expect(stockValue.getByText('54.00 CAD')).toBeInTheDocument();
    expect(stockValue.getByText('12 units in stock')).toBeInTheDocument();
    const lowStock = await findPanel('Low stock (0)');
    expect(lowStock.getByText('Nothing is low on stock.')).toBeInTheDocument();
  });

  describe('Not selling panel', () => {
    const unsold: InventoryInsights['notSelling'] = [
      { id: 2, name: 'Bookmark', quantity: 9 },
      { id: 3, name: 'Card', quantity: 4 },
      { id: 4, name: 'Notebook', quantity: 6 },
      { id: 5, name: 'Tote', quantity: 2 },
    ];

    it('lists in-stock items with no sales this month, the first three at a time', async () => {
      mockInsights(unsold);
      render(<InventoryAnalyticsPage />, { wrapper: Providers });

      const panel = await findPanel('Not selling (4)');
      expect(panel.getByText('October, no sales')).toBeInTheDocument();
      expect(panel.getByText('Bookmark')).toBeInTheDocument();
      expect(panel.getByText('9 left')).toBeInTheDocument();
      expect(panel.getByText('Notebook')).toBeInTheDocument();
      expect(panel.queryByText('Tote')).not.toBeInTheDocument();
    });

    it('expands to the whole list and back', async () => {
      const user = userEvent.setup();
      mockInsights(unsold);
      render(<InventoryAnalyticsPage />, { wrapper: Providers });

      const panel = await findPanel('Not selling (4)');
      await user.click(panel.getByRole('button', { name: 'Expand list' }));
      expect(panel.getByText('Tote')).toBeInTheDocument();
      expect(panel.getByRole('button', { name: 'Show less' })).toHaveAttribute(
        'aria-expanded',
        'true',
      );

      await user.click(panel.getByRole('button', { name: 'Show less' }));
      expect(panel.queryByText('Tote')).not.toBeInTheDocument();
    });

    it('says so when every in-stock item has sold this month', async () => {
      render(<InventoryAnalyticsPage />, { wrapper: Providers });

      const panel = await findPanel('Not selling (0)');
      expect(panel.getByText('Every in-stock item has sold this month.')).toBeInTheDocument();
      expect(panel.queryByRole('button', { name: 'Expand list' })).not.toBeInTheDocument();
    });
  });

  describe('Tied up in unsold stock panel', () => {
    it('shows what the unsold items are worth, and their share of the stock value', async () => {
      mockInsights(
        [
          { id: 2, name: 'Bookmark', quantity: 9 },
          { id: 3, name: 'Card', quantity: 4 },
        ],
        1350,
      );
      render(<InventoryAnalyticsPage />, { wrapper: Providers });

      const panel = await findPanel('Tied up in unsold stock');
      expect(panel.getByText('at selling price')).toBeInTheDocument();
      expect(panel.getByText('13.50 CAD')).toBeInTheDocument();
      // 13.50 of the 54.00 stock value.
      expect(
        panel.getByText('25% of your stock value, in the 2 items with no sales in October'),
      ).toBeInTheDocument();
    });

    it('says when a tiny share rounds below 1%', async () => {
      mockInsights([{ id: 2, name: 'Sticker', quantity: 1 }], 20);
      render(<InventoryAnalyticsPage />, { wrapper: Providers });

      const panel = await findPanel('Tied up in unsold stock');
      expect(
        panel.getByText('under 1% of your stock value, in the 1 item with no sales in October'),
      ).toBeInTheDocument();
    });

    it('shows nothing tied up when every in-stock item has sold', async () => {
      render(<InventoryAnalyticsPage />, { wrapper: Providers });

      const panel = await findPanel('Tied up in unsold stock');
      expect(panel.getByText('0.00 CAD')).toBeInTheDocument();
      expect(
        panel.getByText('Nothing is sitting unsold: every in-stock item has sold this month.'),
      ).toBeInTheDocument();
    });
  });
});
