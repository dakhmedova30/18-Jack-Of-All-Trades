import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as analyticsApi from '../../api/analytics';
import type { AnalyticsSummary } from '../../types';
import { AnalyticsPage } from './AnalyticsPage';

vi.mock('../../api/analytics', () => ({
  getAnalyticsSummary: vi.fn(),
  getInventoryByTag: vi.fn(),
}));

const summary: AnalyticsSummary = {
  totalRevenueCents: 0,
  totalExpensesCents: 0,
  netProfitCents: 0,
  range: '12months',
  granularity: 'month',
  buckets: ['2026-10'],
  bucketLabels: ['Oct'],
  revenueSeries: [],
  expenseSeries: [],
  salesByTag: [],
};

describe('AnalyticsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(analyticsApi.getAnalyticsSummary).mockResolvedValue(summary);
    vi.mocked(analyticsApi.getInventoryByTag).mockResolvedValue({
      byTag: [],
      totalQuantity: 0,
      totalItems: 0,
    });
  });

  it('reloads the dashboard summary when the time range changes', async () => {
    const user = userEvent.setup();
    render(<AnalyticsPage />);

    expect(await screen.findByText('No sales in the last 12 months.')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Time range for the whole dashboard'), 'week');

    await waitFor(() => {
      expect(analyticsApi.getAnalyticsSummary).toHaveBeenCalledWith('week');
    });
    expect(await screen.findByText('No sales in the last 7 days.')).toBeInTheDocument();
  });
});
