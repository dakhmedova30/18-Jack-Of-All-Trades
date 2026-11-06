import type { InventoryInsights } from '../../types';
import { useCurrency } from '../../hooks/useCurrency';
import { formatCents } from '../../utils/money';
import { SummaryPanel } from '../../components/SummaryPanel';

export interface BestSellersPanelProps {
  data?: InventoryInsights;
  error?: string;
  loading: boolean;
  reload: () => void;
}

/** This month's top 3 items by units sold. */
export function BestSellersPanel({ data, error, loading, reload }: BestSellersPanelProps) {
  const currency = useCurrency();
  const month = data
    ? new Date(data.periodStart).toLocaleDateString('en-CA', {
        month: 'long',
        timeZone: 'UTC',
      })
    : '';

  return (
    <SummaryPanel title="Best sellers" context={data && `${month}, by units sold`}>
      {error ? (
        <div className="banner banner--error" role="alert">
          Couldn't load best sellers: {error}{' '}
          <button type="button" className="link-button" onClick={reload}>
            Retry
          </button>
        </div>
      ) : !data ? (
        <p className="empty-state">{loading ? 'Loading…' : 'No data.'}</p>
      ) : data.bestSellers.length === 0 ? (
        <p className="empty-state">No sales yet this month.</p>
      ) : (
        <ol className="summary-panel__list best-sellers">
          {data.bestSellers.map((item, index) => (
            <li key={item.id} className="summary-panel__row">
              <span className="summary-panel__name">
                <span className="best-sellers__rank">{index + 1}</span>
                {item.name}
              </span>
              <span className="summary-panel__detail">
                {item.unitsSold} sold · {formatCents(item.revenueCents, currency)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </SummaryPanel>
  );
}
