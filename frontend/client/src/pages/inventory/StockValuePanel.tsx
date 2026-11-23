import { SummaryPanel } from '../../components/SummaryPanel';
import { useCurrency } from '../../hooks/useCurrency';
import type { InventoryInsights } from '../../types';
import { formatCents } from '../../utils/money';

interface StockValuePanelProps {
  data?: InventoryInsights;
  error?: string;
  loading: boolean;
  reload: () => void;
}

/** What everything in stock is worth at selling price, next to Low stock. */
export function StockValuePanel({ data, error, loading, reload }: StockValuePanelProps) {
  const currency = useCurrency();
  return (
    <SummaryPanel title="Stock value" context="at selling price">
      {error ? (
        <div className="banner banner--error" role="alert">
          Couldn't load stock value: {error}{' '}
          <button type="button" className="link-button" onClick={reload}>
            Retry
          </button>
        </div>
      ) : !data ? (
        <p className="empty-state">{loading ? 'Loading…' : 'No data.'}</p>
      ) : (
        <div className="summary-panel__value-block">
          <span className="summary-panel__value">
            {formatCents(data.stockValueCents, currency)}
          </span>
          <span className="muted">{data.totalUnits.toLocaleString()} units in stock</span>
        </div>
      )}
    </SummaryPanel>
  );
}
