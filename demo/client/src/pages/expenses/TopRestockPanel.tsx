import type { ExpenseMonthBreakdown } from '../../types';
import { formatCents } from '../../utils/money';

export interface TopRestockPanelProps {
  data?: ExpenseMonthBreakdown;
  error?: string;
  loading: boolean;
  reload: () => void;
}

/**
 * The 5 items with the most restock spending this month. Shares the month
 * breakdown request with "Where the money goes", so the two always agree.
 */
export function TopRestockPanel({ data, error, loading, reload }: TopRestockPanelProps) {
  const month = data
    ? new Date(data.periodStart).toLocaleDateString('en-CA', { month: 'long', timeZone: 'UTC' })
    : '';

  return (
    <div className="card low-stock">
      <div className="low-stock__header">
        <h2>Top restock spending</h2>
        {data && <span className="muted">{month}</span>}
      </div>
      {error ? (
        <div className="banner banner--error" role="alert">
          Couldn't load restock spending: {error}{' '}
          <button type="button" className="link-button" onClick={reload}>
            Retry
          </button>
        </div>
      ) : !data ? (
        <p className="empty-state">{loading ? 'Loading…' : 'No data.'}</p>
      ) : data.topRestockItems.length === 0 ? (
        <p className="empty-state">No restocks yet this month.</p>
      ) : (
        <ol className="low-stock__list best-sellers">
          {data.topRestockItems.map((item, index) => (
            <li key={item.id} className="low-stock__row">
              <span className="low-stock__name">
                <span className="best-sellers__rank">{index + 1}</span>
                {item.name}
              </span>
              <span className="low-stock__qty">
                {formatCents(item.spentCents)} · {item.units} units
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
