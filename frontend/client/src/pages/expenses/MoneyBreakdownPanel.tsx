import type { ExpenseMonthBreakdown } from '../../types';
import { useCurrency } from '../../hooks/useCurrency';
import { formatCents } from '../../utils/money';
import { SummaryPanel } from '../../components/SummaryPanel';
import { SERIES_COLORS } from '../analytics/charts';

/** As the "Restocks and running costs" chart colours them. */
const RESTOCK_COLOR = SERIES_COLORS[2];
const RUNNING_COLOR = SERIES_COLORS[3];

export interface MoneyBreakdownPanelProps {
  data?: ExpenseMonthBreakdown;
  error?: string;
  loading: boolean;
  reload: () => void;
}

/** This month's spending split into restocks (inventory) vs running costs, as a bar and rows. */
export function MoneyBreakdownPanel({ data, error, loading, reload }: MoneyBreakdownPanelProps) {
  const currency = useCurrency();
  const month = data
    ? new Date(data.periodStart).toLocaleDateString('en-CA', { month: 'long', timeZone: 'UTC' })
    : '';
  const rows = data
    ? [
        {
          key: 'restock',
          label: 'Restock (inventory)',
          cents: data.restockCents,
          color: RESTOCK_COLOR,
        },
        { key: 'running', label: 'Running costs', cents: data.runningCents, color: RUNNING_COLOR },
      ]
    : [];

  return (
    <SummaryPanel
      title="Where the money goes"
      context={data && `${month} · ${formatCents(data.totalCents, currency)} total`}
    >
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
        <>
          {/* The rows give the same numbers in words, so the bar is decoration for screen readers. */}
          <div className="money-split" aria-hidden="true">
            {rows.map(({ key, cents, color }) => (
              <span key={key} style={{ flexGrow: cents, background: color }} />
            ))}
          </div>
          <ul className="summary-panel__list">
            {rows.map(({ key, label, cents, color }) => {
              const percent = Math.round((cents / data.totalCents) * 100);
              return (
                <li key={key} className="summary-panel__row">
                  <span className="summary-panel__name">
                    <span
                      className="money-split__swatch"
                      style={{ background: color }}
                      aria-hidden="true"
                    />
                    {label}
                  </span>
                  <span className="summary-panel__detail">
                    {formatCents(cents, currency)} · {percent}%
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </SummaryPanel>
  );
}
