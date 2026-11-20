import { AnalyticsSubpage } from './AnalyticsSubpage';

/** /analytics/expenses: deeper analytics on expenses. */
export function ExpenseAnalyticsPage() {
  return (
    <AnalyticsSubpage slug="expenses">
      <p className="empty-state">Detailed expense analytics are coming soon.</p>
    </AnalyticsSubpage>
  );
}
