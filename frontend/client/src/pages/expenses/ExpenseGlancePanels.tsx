import { SummaryPanel } from '../../components/SummaryPanel';
import { useCurrency } from '../../hooks/useCurrency';
import { usePreferences } from '../../hooks/usePreferences';
import type { ExpenseMonthBreakdown } from '../../types';
import { formatCents } from '../../utils/money';

export interface ExpenseGlancePanelsProps {
  data?: ExpenseMonthBreakdown;
  error?: string;
  loading: boolean;
  reload: () => void;
}

/** "November" for the month starting at `periodStart`, or the one `offset` months from it. */
function monthOf(periodStart: string, offset = 0): string {
  const start = new Date(periodStart);
  const month = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + offset, 1));
  return month.toLocaleDateString('en-CA', { month: 'long', timeZone: 'UTC' });
}

/**
 * How this month's spending so far compares with all of last month. Only an overshoot gets a
 * percentage: part of a month being under a whole one isn't saving anything yet.
 */
function comparison(data: ExpenseMonthBreakdown, money: (cents: number) => string): string {
  const lastMonth = monthOf(data.periodStart, -1);
  const { totalCents, previousTotalCents } = data;
  if (previousTotalCents === 0) {
    return totalCents === 0 ? 'No expenses yet' : `None in ${lastMonth}`;
  }
  if (totalCents > previousTotalCents) {
    const percent = Math.max(
      1,
      Math.round(((totalCents - previousTotalCents) / previousTotalCents) * 100),
    );
    return `Already ${percent}% more than ${lastMonth}`;
  }
  return `${money(previousTotalCents)} in all of ${lastMonth}`;
}

/**
 * This month's spending so far against last month's, and its largest expense, as two panels
 * (like Sales Analytics' month at a glance). They share the month breakdown request.
 */
export function ExpenseGlancePanels({ data, error, loading, reload }: ExpenseGlancePanelsProps) {
  const { formatDate } = usePreferences();
  const currency = useCurrency();
  const money = (cents: number) => formatCents(cents, currency);
  const month = data ? monthOf(data.periodStart) : undefined;
  const largest = data?.largestExpense;

  const panels = [
    {
      title: 'Spent',
      value: data ? money(data.totalCents) : '',
      detail: data ? comparison(data, money) : '',
    },
    {
      title: 'Largest expense',
      value: largest ? money(largest.totalCents) : '—',
      detail: largest
        ? `${largest.description || 'An expense'} · on ${formatDate(largest.incurredAt)}`
        : 'No expenses yet',
    },
  ];

  return (
    <>
      {panels.map(({ title, value, detail }) => (
        <SummaryPanel key={title} title={title} context={month}>
          {error ? (
            <div className="banner banner--error" role="alert">
              Couldn't load this month's spending: {error}{' '}
              <button type="button" className="link-button" onClick={reload}>
                Retry
              </button>
            </div>
          ) : !data ? (
            <p className="empty-state">{loading ? 'Loading…' : 'No data.'}</p>
          ) : (
            <div className="summary-panel__value-block">
              <span className="summary-panel__value">{value}</span>
              <span className="muted summary-panel__value-detail" title={detail}>
                {detail}
              </span>
            </div>
          )}
        </SummaryPanel>
      ))}
    </>
  );
}
