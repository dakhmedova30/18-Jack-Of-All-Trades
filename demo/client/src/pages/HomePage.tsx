import { Link } from 'react-router-dom';
import { useAnalyticsSummary } from '../hooks/useAnalyticsSummary';
import { useItemCount } from '../hooks/useItemCount';
import { useLowStock } from '../hooks/useLowStock';
import { useRecentSales } from '../hooks/useRecentSales';
import type { AnalyticsSummary, LowStock, Sale } from '../types';
import { usePreferences } from '../hooks/usePreferences';
import { formatCents } from '../utils/money';
import {
  AnalyticsPreview,
  ExpensesPreview,
  InventoryPreview,
  SalesPreview,
  type PreviewState,
} from './HomeCardPreviews';

type SummaryResult = ReturnType<typeof useAnalyticsSummary>;

/** Keeps showing the last data while a reload is in flight, like the KPI strip does. */
function toPreviewState<T>(data: T | undefined, error: string | undefined): PreviewState<T> {
  if (data !== undefined) return { status: 'ready', data };
  return error ? { status: 'error' } : { status: 'loading' };
}

export function HomePage() {
  // One month-summary request feeds both the KPI strip and the card previews.
  const summary = useAnalyticsSummary('month');
  const itemCount = useItemCount();
  const summaryState: PreviewState<AnalyticsSummary> = toPreviewState(summary.data, summary.error);

  const dashboards = [
    { to: '/sales', title: 'Sales', preview: <SalesPreview summary={summaryState} /> },
    {
      to: '/inventory',
      title: 'Inventory',
      preview: <InventoryPreview itemCount={toPreviewState(itemCount.count, itemCount.error)} />,
    },
    { to: '/expenses', title: 'Expenses', preview: <ExpensesPreview summary={summaryState} /> },
    { to: '/analytics', title: 'Analytics', preview: <AnalyticsPreview summary={summaryState} /> },
  ];

  return (
    <section className="page home">
      <h1>Welcome back</h1>
      <p className="muted">Pick a dashboard to get started.</p>
      <KpiStrip summary={summary} />
      <div className="home-cards">
        {dashboards.map(({ to, title, preview }) => (
          <Link key={to} to={to} className="home-card">
            <h2 className="home-card__title">{title}</h2>
            {preview}
          </Link>
        ))}
      </div>
      <RecentSales />
    </section>
  );
}

const RECENT_SALES_COUNT = 5;
const ITEMS_NAMED_PER_SALE = 2;

/** "Ceramic planter ×2, Soap ×1 +1 more": the first few line items, the rest counted. */
function describeSaleItems(sale: Sale): string {
  const named = sale.items
    .slice(0, ITEMS_NAMED_PER_SALE)
    .map((item) => `${item.itemName} ×${item.quantity}`)
    .join(', ');
  const remaining = sale.items.length - ITEMS_NAMED_PER_SALE;
  return remaining > 0 ? `${named} +${remaining} more` : named;
}

/** The latest sales by sale date. Display only: rows don't open the sale. */
function RecentSales() {
  const { formatDate } = usePreferences();
  const { sales, error, loading, reload } = useRecentSales(RECENT_SALES_COUNT);

  return (
    <div className="card home-recent">
      <div className="home-recent__header">
        <h2>Recent sales</h2>
        <Link to="/sales" className="home-recent__link">
          View all sales →
        </Link>
      </div>
      {error ? (
        <div className="banner banner--error" role="alert">
          Couldn't load recent sales: {error}{' '}
          <button type="button" className="link-button" onClick={reload}>
            Retry
          </button>
        </div>
      ) : !sales ? (
        <p className="empty-state">{loading ? 'Loading recent sales…' : 'No data.'}</p>
      ) : sales.length === 0 ? (
        <p className="empty-state">No sales recorded yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Items</th>
                <th className="numeric">Total</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id}>
                  <td className="home-recent__date">{formatDate(sale.soldAt)}</td>
                  <td className="home-recent__items">{describeSaleItems(sale)}</td>
                  <td className="numeric home-recent__amount">+{formatCents(sale.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Month-to-date Revenue / Expenses / Net Profit, from the Analytics summary's
 * "month" range, plus a Low stock warning. No vs-last-month comparison yet:
 * the summary has no matching prior window, and comparing part of this month
 * to all of last month would make every tile look worse until the month ends.
 * The two requests load independently, so one failing still leaves the
 * other's tiles showing.
 */
function KpiStrip({ summary }: { summary: SummaryResult }) {
  const lowStock = useLowStock();

  const data = summary.data;
  const moneyPlaceholder = summary.loading && !data ? '…' : '—';
  const revenue = data?.totalRevenueCents;
  const netProfit = data?.netProfitCents;
  const margin =
    revenue !== undefined && netProfit !== undefined && revenue > 0
      ? `${Math.round((netProfit / revenue) * 100)}% margin`
      : undefined;

  return (
    <>
      {summary.error && (
        <KpiError
          message={`Couldn't load this month's numbers: ${summary.error}`}
          onRetry={summary.reload}
        />
      )}
      {lowStock.error && (
        <KpiError
          message={`Couldn't load low stock: ${lowStock.error}`}
          onRetry={lowStock.reload}
        />
      )}
      <div className="home-kpis" aria-busy={summary.loading || lowStock.loading}>
        <KpiTile
          label="Revenue · this month"
          value={revenue !== undefined ? formatCents(revenue) : moneyPlaceholder}
          tone="neutral"
        />
        <KpiTile
          label="Expenses · this month"
          value={data ? formatCents(data.totalExpensesCents) : moneyPlaceholder}
          tone="neutral"
        />
        <KpiTile
          label="Net Profit · this month"
          value={netProfit !== undefined ? formatCents(netProfit) : moneyPlaceholder}
          tone={netProfit === undefined ? 'neutral' : netProfit >= 0 ? 'positive' : 'negative'}
          detail={margin}
        />
        <LowStockTile data={lowStock.data} loading={lowStock.loading} />
      </div>
    </>
  );
}

function LowStockTile({ data, loading }: { data?: LowStock; loading: boolean }) {
  if (!data) {
    return <KpiTile label="Low stock" value={loading ? '…' : '—'} tone="neutral" />;
  }
  if (data.count === 0) {
    return (
      <KpiTile
        label="Low stock"
        value="0 items"
        tone="neutral"
        detail={`Nothing at ${data.threshold} or below`}
      />
    );
  }
  // "Candle (2), Soap (4)…": the ellipsis only when more items are low than are named.
  const names = data.items.map((item) => `${item.name} (${item.quantity})`).join(', ');
  return (
    <KpiTile
      label={`Low stock · ${data.threshold} or below`}
      value={`${data.count} ${data.count === 1 ? 'item' : 'items'}`}
      tone="negative"
      detail={data.count > data.items.length ? `${names}…` : names}
    />
  );
}

function KpiError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="banner banner--error home-kpis__error" role="alert">
      {message}{' '}
      <button type="button" className="link-button" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

interface KpiTileProps {
  label: string;
  value: string;
  tone: 'positive' | 'negative' | 'neutral';
  detail?: string;
}

function KpiTile({ label, value, tone, detail }: KpiTileProps) {
  return (
    <div className={`stat-card stat-card--${tone}`}>
      <span className="stat-card__label">{label}</span>
      <span className="stat-card__value">{value}</span>
      {detail && <span className="stat-card__detail">{detail}</span>}
    </div>
  );
}
