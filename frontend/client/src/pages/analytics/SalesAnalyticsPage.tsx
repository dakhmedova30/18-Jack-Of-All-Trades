import { useInventoryInsights } from '../../hooks/useInventoryInsights';
import { useSalesMonthSummary } from '../../hooks/useSalesMonthSummary';
import { BestSellersPanel } from '../sales/BestSellersPanel';
import { MonthGlancePanel } from '../sales/MonthGlancePanel';
import { AnalyticsSubpage } from './AnalyticsSubpage';

/** /analytics/sales: this month's sales count, average and largest sale, and best sellers. */
export function SalesAnalyticsPage() {
  const monthSummary = useSalesMonthSummary();
  const insights = useInventoryInsights();

  return (
    <AnalyticsSubpage slug="sales">
      <div className="panel-row">
        <MonthGlancePanel {...monthSummary} />
        <BestSellersPanel {...insights} />
      </div>
    </AnalyticsSubpage>
  );
}
