import { useInventoryInsights } from '../../hooks/useInventoryInsights';
import { useLowStock } from '../../hooks/useLowStock';
import { LowStockPanel } from '../inventory/LowStockPanel';
import { NotSellingPanel } from '../inventory/NotSellingPanel';
import { StockValuePanel } from '../inventory/StockValuePanel';
import { AnalyticsSubpage } from './AnalyticsSubpage';

/** The server's max; enough to list every low item for any realistic shop. */
const LOW_STOCK_LIST_LIMIT = 100;

/** /analytics/inventory: what stock is worth, what's running low and what isn't selling. */
export function InventoryAnalyticsPage() {
  const lowStock = useLowStock(LOW_STOCK_LIST_LIMIT);
  const insights = useInventoryInsights();

  return (
    <AnalyticsSubpage slug="inventory">
      <div className="panel-row">
        <StockValuePanel {...insights} />
        <LowStockPanel {...lowStock} />
        <NotSellingPanel {...insights} />
      </div>
    </AnalyticsSubpage>
  );
}
