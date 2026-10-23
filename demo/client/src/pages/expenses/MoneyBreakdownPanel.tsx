import type { ExpenseMonthBreakdown } from '../../types';
import { formatCents } from '../../utils/money';

export interface MoneyBreakdownPanelProps {
  data?: ExpenseMonthBreakdown;
  error?: string;
  loading: boolean;
  reload: () => void;
}

/** This month's spending split into restocks (inventory) vs running costs, as bars. */
export function MoneyBreakdownPanel({ data, error, loading, reload }: MoneyBreakdownPanelProps) {
  const month = data
    ? new Date(data.periodStart).toLocaleDateString('en-CA', { month: 'long', timeZone: 'UTC' })
    : '';
  const rows = data
    ? [
        {
          key: 'restock',
          label: 'Restock (inventory)',
          hint: 'Lines linked to an inventory item',
          cents: data.restockCents,
        },
        {
          key: 'running',
          label: 'Running costs',
          hint: 'Rent, fees, supplies and other free-text lines',
          cents: data.runningCents,
        },
      ]
    : [];

  return (
    <div className="card low-stock">
      <div className="low-stock__header">
        <h2>Where the money goes</h2>
        {data && (
          <span className="muted">
            {month} · {formatCents(data.totalCents)} total
          </span>
        )}
      </div>
      {error ? (
        <div className="banner banner--error" role="alert">
          Couldn't load this month's spending: {error}{' '}
          <button type="button" className="link-button" onClick={reload}>
            Retry
          </button>
        </div>
      ) : !data ? (
        <p className="empty-state">{loading ? 'Loading…' : 'No data.'}</p>
      ) : data.totalCents === 0 ? (
        <p className="empty-state">No expenses yet this month.</p>
      ) : (
        <ul className="money-split">
          {rows.map(({ key, label, hint, cents }) => {
            const percent = Math.round((cents / data.totalCents) * 100);
            return (
              <li key={key} className="money-split__row" title={hint}>
                <span className="money-split__label">{label}</span>
                <span className="money-split__track">
                  <span
                    className={`money-split__fill money-split__fill--${key}`}
                    style={{ width: `${(cents / data.totalCents) * 100}%` }}
                  />
                </span>
                <span className="money-split__value">
                  {formatCents(cents)} · {percent}%
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
