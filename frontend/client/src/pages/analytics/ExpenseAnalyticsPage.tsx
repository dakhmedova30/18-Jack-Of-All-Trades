import { useExpenseMonthBreakdown } from '../../hooks/useExpenseMonthBreakdown';
import { MoneyBreakdownPanel } from '../expenses/MoneyBreakdownPanel';
import { TopRestockPanel } from '../expenses/TopRestockPanel';
import { AnalyticsSubpage } from './AnalyticsSubpage';

/** /analytics/expenses: where this month's money goes, and the items with the most restock spending. */
export function ExpenseAnalyticsPage() {
  const breakdown = useExpenseMonthBreakdown();

  return (
    <AnalyticsSubpage slug="expenses">
      <div className="panel-row">
        <MoneyBreakdownPanel {...breakdown} />
        <TopRestockPanel {...breakdown} />
      </div>
    </AnalyticsSubpage>
  );
}
