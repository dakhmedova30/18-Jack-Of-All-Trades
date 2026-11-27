import { useCallback, useMemo, useState } from 'react';
import { ExpenseScopeNotice } from '../../components/ExpenseScopeNotice';
import { getExpenseTagsInUse, getExpenseTrends } from '../../api/analytics';
import { useAnalyticsDateRange } from '../../hooks/useAnalyticsDateRange';
import { useApiData } from '../../hooks/useApiData';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useExpenseMonthBreakdown } from '../../hooks/useExpenseMonthBreakdown';
import type { DateRange } from '../../types';
import { ExpenseGlancePanels } from '../expenses/ExpenseGlancePanels';
import { MoneyBreakdownPanel } from '../expenses/MoneyBreakdownPanel';
import { TopRestockPanel } from '../expenses/TopRestockPanel';
import { ChartFilters, RELOAD_DELAY_MS, useChartPeriod } from './analyticsPeriod';
import { AnalyticsSubpage } from './AnalyticsSubpage';
import { ChartSection, PeriodChartsSection } from './ChartCard';
import { ExpenseCharts } from './ExpenseCharts';

/**
 * /analytics/expenses: the filters (the main Analytics page's dates, and expense tags) beside
 * where this month's money goes and the items with the most restock spending; then charts of
 * spending over time (a line per tag), profit, restocks against running costs, and spending by
 * tag, for the chosen period and tags.
 */
export function ExpenseAnalyticsPage() {
  const breakdown = useExpenseMonthBreakdown();
  const dates = useAnalyticsDateRange();
  const period = useChartPeriod(dates.data);
  // The ticked tags' names, as expenses store them.
  const [ticked, setTicked] = useState<string[]>([]);
  // The tags expenses have (with "Untagged"), not the form's list: a removed tag stays on expenses.
  const tags = useApiData(getExpenseTagsInUse);
  // Ticking none or every tag shows them all, so neither narrows the charts.
  const narrowed = tags.data && ticked.length > 0 && ticked.length < tags.data.length ? ticked : [];
  // JSON, since a tag can contain a comma; as with the dates, it waits for the boxes to settle.
  const tagKey = useDebouncedValue(JSON.stringify(narrowed), RELOAD_DELAY_MS);

  return (
    <AnalyticsSubpage slug="expenses">
      <ExpenseScopeNotice />
      <div className="analytics-subpage__top">
        {/* Always there, so the cards keep their place while the filters load. */}
        <div className="analytics-subpage__filters">
          {dates.data && period && (
            <ChartFilters
              dates={dates.data}
              period={period}
              choice={{
                heading: 'Expense tags',
                label: 'Tags',
                allLabel: 'All tags',
                plural: 'tags',
                options: tags.data?.map((name) => ({ value: name, label: name })),
                error: tags.error,
                value: ticked,
                onChange: setTicked,
                note: "Narrows the charts below by each expense's first tag. Tick none or all to see every tag.",
              }}
            />
          )}
        </div>
        <div className="panel-row">
          <ExpenseGlancePanels {...breakdown} />
          <MoneyBreakdownPanel {...breakdown} />
          <TopRestockPanel {...breakdown} />
        </div>
      </div>
      <PeriodChartsSection dates={dates} period={period} label="expense trends">
        {(requested) => <ExpenseTrendsCharts period={requested} tagKey={tagKey} />}
      </PeriodChartsSection>
    </AnalyticsSubpage>
  );
}

interface ExpenseTrendsChartsProps {
  period: DateRange;
  /** The chosen tags as a JSON list; "[]" for every expense. A string, so it's stable. */
  tagKey: string;
}

/**
 * The charts for one settled period and choice of tags; a new choice reloads them, keeping the old
 * ones dimmed.
 */
function ExpenseTrendsCharts({ period, tagKey }: ExpenseTrendsChartsProps) {
  const chosen = useMemo(() => JSON.parse(tagKey) as string[], [tagKey]);
  const load = useCallback(
    () => getExpenseTrends(period, chosen.length > 0 ? chosen : undefined),
    [period, chosen],
  );
  const trends = useApiData(load);
  return (
    <ChartSection resource={trends} label="expense trends">
      {(data) => (
        <ExpenseCharts data={data} period={period} tags={chosen.length > 0 ? chosen : null} />
      )}
    </ChartSection>
  );
}
