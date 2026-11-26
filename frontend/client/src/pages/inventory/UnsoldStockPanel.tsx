import { SummaryPanel } from '../../components/SummaryPanel';
import { useCurrency } from '../../hooks/useCurrency';
import type { InventoryInsights } from '../../types';
import { formatCents } from '../../utils/money';

interface UnsoldStockPanelProps {
  data?: InventoryInsights;
  error?: string;
  loading: boolean;
  reload: () => void;
}

/** "18%", or "under 1%" for a share too small to round to 1 but still there. */
function shareOf(part: number, total: number): string {
  const percent = Math.round((part / total) * 100);
  return percent === 0 && part > 0 ? 'under 1%' : `${percent}%`;
}

/**
 * The money sitting in the items Not selling lists: what they're worth at selling price, and how
 * much of all the stock value that is.
 */
export function UnsoldStockPanel({ data, error, loading, reload }: UnsoldStockPanelProps) {
  const currency = useCurrency();
  const month = data
    ? new Date(data.periodStart).toLocaleDateString('en-CA', { month: 'long', timeZone: 'UTC' })
    : '';
  const count = data?.notSelling.length ?? 0;
  const items = `the ${count.toLocaleString()} ${count === 1 ? 'item' : 'items'} with no sales in ${month}`;
  const detail = !data
    ? ''
    : count === 0
      ? 'Nothing is sitting unsold: every in-stock item has sold this month.'
      : data.stockValueCents > 0
        ? `${shareOf(data.notSellingValueCents, data.stockValueCents)} of your stock value, in ${items}`
        : `In ${items}`;

  return (
    <SummaryPanel title="Tied up in unsold stock" context="at selling price">
      {error ? (
        <div className="banner banner--error" role="alert">
          Couldn't load unsold stock: {error}{' '}
          <button type="button" className="link-button" onClick={reload}>
            Retry
          </button>
        </div>
      ) : !data ? (
        <p className="empty-state">{loading ? 'Loading…' : 'No data.'}</p>
      ) : (
        <div className="summary-panel__value-block">
          <span className="summary-panel__value">
            {formatCents(data.notSellingValueCents, currency)}
          </span>
          <span className="muted">{detail}</span>
        </div>
      )}
    </SummaryPanel>
  );
}
