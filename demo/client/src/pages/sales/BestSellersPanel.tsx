import type { InventoryInsights } from '../../types';
import { formatCents } from '../../utils/money';

export interface BestSellersPanelProps {
  data?: InventoryInsights;
  error?: string;
  loading: boolean;
  reload: () => void;
}

/** This month's top 3 items by units sold. */
export function BestSellersPanel({ data, error, loading, reload }: BestSellersPanelProps) {
  const month = data
    ? new Date(data.periodStart).toLocaleDateString('en-CA', {
        month: 'long',
        timeZone: 'UTC',
      })
    : '';

  return (
    <div className="card low-stock">
      <div className="low-stock__header">
        <h2>Best sellers</h2>
        {data && <span className="muted">{month}, by units sold</span>}
      </div>
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
        <ol className="low-stock__list best-sellers">
          {data.bestSellers.map((item, index) => (
            <li key={item.id} className="low-stock__row">
              <span className="low-stock__name">
                <span className="best-sellers__rank">{index + 1}</span>
                {item.name}
              </span>
              <span className="low-stock__qty">
                {item.unitsSold} sold · {formatCents(item.revenueCents)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
