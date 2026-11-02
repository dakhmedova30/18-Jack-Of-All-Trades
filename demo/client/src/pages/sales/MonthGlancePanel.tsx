import { SummaryPanel } from '../../components/SummaryPanel';
import type { SalesMonthSummary } from '../../types';
import { formatDate } from '../../utils/date';
import { formatCents } from '../../utils/money';

export interface MonthGlancePanelProps {
  data?: SalesMonthSummary;
  error?: string;
  loading: boolean;
  reload: () => void;
}

/** This month's sales count, average sale value and largest sale as separate panels. */
export function MonthGlancePanel({ data, error, loading, reload }: MonthGlancePanelProps) {
  const month = data
    ? new Date(data.periodStart).toLocaleDateString('en-CA', { month: 'long', timeZone: 'UTC' })
    : undefined;

  const metrics = data
    ? [
        {
          title: 'Sales',
          value: data.saleCount.toLocaleString(),
          detail: data.saleCount === 1 ? 'sale this month' : 'sales this month',
        },
        {
          title: 'Average sale',
          value: data.saleCount > 0 ? formatCents(data.averageSaleCents) : '—',
          detail: data.saleCount > 0 ? 'per sale' : 'No sales yet',
        },
        {
          title: 'Largest sale',
          value: data.largestSale ? formatCents(data.largestSale.totalCents) : '—',
          detail: data.largestSale ? `on ${formatDate(data.largestSale.soldAt)}` : 'No sales yet',
        },
      ]
    : [
        { title: 'Sales', value: '', detail: '' },
        { title: 'Average sale', value: '', detail: '' },
        { title: 'Largest sale', value: '', detail: '' },
      ];

  return (
    <>
      {metrics.map(({ title, value, detail }) => (
        <SummaryPanel key={title} title={title} context={month}>
          {error ? (
            <div className="banner banner--error" role="alert">
              Couldn't load this month's sales: {error}{' '}
              <button type="button" className="link-button" onClick={reload}>
                Retry
              </button>
            </div>
          ) : !data ? (
            <p className="empty-state">{loading ? 'Loading…' : 'No data.'}</p>
          ) : (
            <div className="summary-panel__value-block">
              <span className="summary-panel__value">{value}</span>
              <span className="muted">{detail}</span>
            </div>
          )}
        </SummaryPanel>
      ))}
    </>
  );
}
