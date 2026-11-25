import { useCallback } from 'react';
import { getSalesTrends } from '../../api/analytics';
import { useAnalyticsDateRange } from '../../hooks/useAnalyticsDateRange';
import { useApiData } from '../../hooks/useApiData';
import { useInventoryInsights } from '../../hooks/useInventoryInsights';
import { useSalesMonthSummary } from '../../hooks/useSalesMonthSummary';
import type { DateRange } from '../../types';
import { BestSellersPanel } from '../sales/BestSellersPanel';
import { MonthGlancePanel } from '../sales/MonthGlancePanel';
import { ChartFilters, useChartPeriod } from './analyticsPeriod';
import { AnalyticsSubpage } from './AnalyticsSubpage';
import { ChartSection, PeriodChartsSection } from './ChartCard';
import { SalesCharts } from './SalesCharts';

/**
 * /analytics/sales: this month's sales count, average and largest sale, and best sellers, then
 * charts of revenue, sales, average sale, busiest days and channels for the period chosen in the
 * date filter at the top right (as on the main Analytics page).
 */
export function SalesAnalyticsPage() {
  const monthSummary = useSalesMonthSummary();
  const insights = useInventoryInsights();
  const dates = useAnalyticsDateRange();
  const period = useChartPeriod(dates.data);

  return (
    <AnalyticsSubpage
      slug="sales"
      actions={dates.data && period && <ChartFilters dates={dates.data} period={period} />}
    >
      <div className="panel-row">
        <MonthGlancePanel {...monthSummary} />
        <BestSellersPanel {...insights} />
      </div>
      <PeriodChartsSection dates={dates} period={period} label="sales trends">
        {(requested) => <SalesTrendsCharts period={requested} />}
      </PeriodChartsSection>
    </AnalyticsSubpage>
  );
}

/** The charts for one settled period; a new period reloads them, keeping the old ones dimmed. */
function SalesTrendsCharts({ period }: { period: DateRange }) {
  const load = useCallback(() => getSalesTrends(period), [period]);
  const trends = useApiData(load);
  return (
    <ChartSection resource={trends} label="sales trends">
      {(data) => <SalesCharts data={data} period={period} />}
    </ChartSection>
  );
}
