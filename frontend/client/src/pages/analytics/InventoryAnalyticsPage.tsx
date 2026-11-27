import { getStockHealth } from '../../api/analytics';
import { useApiData } from '../../hooks/useApiData';
import { useInventoryInsights } from '../../hooks/useInventoryInsights';
import { useLowStock } from '../../hooks/useLowStock';
import { LowStockPanel } from '../inventory/LowStockPanel';
import { NotSellingPanel } from '../inventory/NotSellingPanel';
import { StockValuePanel } from '../inventory/StockValuePanel';
import { UnsoldStockPanel } from '../inventory/UnsoldStockPanel';
import { AnalyticsSubpage } from './AnalyticsSubpage';
import { ChartSection } from './ChartCard';
import { StockCharts } from './StockCharts';

/** The server's max; enough to list every low item for any realistic shop. */
const LOW_STOCK_LIST_LIMIT = 100;

/**
 * /analytics/inventory: what stock is worth, what's running low, what isn't selling and the money
 * tied up in it, then charts of stock levels, value by tag and what will run out first.
 */
export function InventoryAnalyticsPage() {
  const lowStock = useLowStock(LOW_STOCK_LIST_LIMIT);
  const insights = useInventoryInsights();
  const stockHealth = useApiData(getStockHealth);

  return (
    <AnalyticsSubpage slug="inventory">
      <div className="panel-row">
        <StockValuePanel {...insights} />
        <LowStockPanel {...lowStock} />
        <NotSellingPanel {...insights} />
        <UnsoldStockPanel {...insights} />
      </div>
      <ChartSection resource={stockHealth} label="stock health">
        {(data) => <StockCharts data={data} />}
      </ChartSection>
    </AnalyticsSubpage>
  );
}
