import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authApi from '../../api/auth';
import * as itemApi from '../../api/items';
import { PageProviders } from '../../test/providers';
import type { InventoryInsights } from '../../types';
import { InventoryAnalyticsPage } from './InventoryAnalyticsPage';

vi.mock('../../api/auth', () => ({
  getCurrentBusiness: vi.fn(),
}));

vi.mock('../../api/items', () => ({
  getInventoryInsights: vi.fn(),
  getLowStock: vi.fn(),
}));

/** The page links back to Analytics, so it needs a router too. */
function Providers({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <PageProviders>{children}</PageProviders>
    </MemoryRouter>
  );
}

function mockInsights(notSelling: InventoryInsights['notSelling']) {
  vi.mocked(itemApi.getInventoryInsights).mockResolvedValue({
    stockValueCents: 5400,
    totalUnits: 12,
    periodStart: '2026-10-01',
    periodEnd: '2026-11-01',
    bestSellers: [],
    worstSeller: null,
    notSelling,
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
    mockInsights([]);
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
});
