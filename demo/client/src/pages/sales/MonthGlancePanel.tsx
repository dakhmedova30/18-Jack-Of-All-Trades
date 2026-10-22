import type { SalesMonthSummary } from '../../types';
import { formatDate } from '../../utils/date';
import { formatCents } from '../../utils/money';

export interface MonthGlancePanelProps {
  data?: SalesMonthSummary;
  error?: string;
  loading: boolean;
  reload: () => void;
}

/** This month's number of sales, average sale value and largest sale. */
export function MonthGlancePanel({ data, error, loading, reload }: MonthGlancePanelProps) {
  const month = data
    ? new Date(data.periodStart).toLocaleDateString('en-CA', { month: 'long', timeZone: 'UTC' })
    : '';

  return (
    <div className="card low-stock">
      <div className="low-stock__header">
        <h2>This month at a glance</h2>
        {data && <span className="muted">{month}</span>}
      </div>
      {error ? (
        <div className="banner banner--error" role="alert">
          Couldn't load this month's sales: {error}{' '}
          <button type="button" className="link-button" onClick={reload}>
            Retry
          </button>
        </div>
      ) : !data ? (
        <p className="empty-state">{loading ? 'Loading…' : 'No data.'}</p>
      ) : data.saleCount === 0 ? (
        <p className="empty-state">No sales yet this month.</p>
      ) : (
        <dl className="glance">
          <div className="glance__item">
            <dt>Sales</dt>
            <dd>{data.saleCount.toLocaleString()}</dd>
          </div>
          <div className="glance__item">
            <dt>Average sale</dt>
            <dd>{formatCents(data.averageSaleCents)}</dd>
          </div>
          <div className="glance__item">
            <dt>Largest sale</dt>
            <dd>{data.largestSale ? formatCents(data.largestSale.totalCents) : '—'}</dd>
            {data.largestSale && (
              <span className="muted glance__note">on {formatDate(data.largestSale.soldAt)}</span>
            )}
          </div>
        </dl>
      )}
    </div>
  );
}
