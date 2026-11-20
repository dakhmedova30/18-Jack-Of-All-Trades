import { AnalyticsSubpage } from './AnalyticsSubpage';

/** /analytics/sales: deeper analytics on sales. */
export function SalesAnalyticsPage() {
  return (
    <AnalyticsSubpage slug="sales">
      <p className="empty-state">Detailed sales analytics are coming soon.</p>
    </AnalyticsSubpage>
  );
}
