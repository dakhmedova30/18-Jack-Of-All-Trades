import { useCallback } from 'react';
import { getExpenseTrends } from '../../api/analytics';
import { useAnalyticsDateRange } from '../../hooks/useAnalyticsDateRange';
import { useApiData } from '../../hooks/useApiData';
import { useExpenseMonthBreakdown } from '../../hooks/useExpenseMonthBreakdown';
import type { DateRange } from '../../types';
import { MoneyBreakdownPanel } from '../expenses/MoneyBreakdownPanel';
import { TopRestockPanel } from '../expenses/TopRestockPanel';
import { ChartFilters, useChartPeriod } from './analyticsPeriod';
import { AnalyticsSubpage } from './AnalyticsSubpage';
import { ChartSection, PeriodChartsSection } from './ChartCard';
import { ExpenseCharts } from './ExpenseCharts';

/**
 * /analytics/expenses: where this month's money goes and the items with the most restock spending,
 * then charts of revenue against expenses, profit, cost types and spending by tag for the period
 * chosen in the date filter at the top right (as on the main Analytics page).
 */
export function ExpenseAnalyticsPage() {
  const breakdown = useExpenseMonthBreakdown();
  const dates = useAnalyticsDateRange();
  const period = useChartPeriod(dates.data);

  return (
    <AnalyticsSubpage
      slug="expenses"
      actions={dates.data && period && <ChartFilters dates={dates.data} period={period} />}
    >
      <div className="panel-row">
        <MoneyBreakdownPanel {...breakdown} />
        <TopRestockPanel {...breakdown} />
      </div>
      <PeriodChartsSection dates={dates} period={period} label="expense trends">
        {(requested) => <ExpenseTrendsCharts period={requested} />}
      </PeriodChartsSection>
    </AnalyticsSubpage>
  );
}

/** The charts for one settled period; a new period reloads them, keeping the old ones dimmed. */
function ExpenseTrendsCharts({ period }: { period: DateRange }) {
  const load = useCallback(() => getExpenseTrends(period), [period]);
  const trends = useApiData(load);
  return (
    <ChartSection resource={trends} label="expense trends">
      {(data) => <ExpenseCharts data={data} period={period} />}
    </ChartSection>
  );
}
