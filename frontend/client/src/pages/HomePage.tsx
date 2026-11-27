import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAnalyticsSummary } from '../hooks/useAnalyticsSummary';
import { useAuth } from '../hooks/useAuth';
import { useInventoryInsights } from '../hooks/useInventoryInsights';
import { useItemCount } from '../hooks/useItemCount';
import { useLowStock } from '../hooks/useLowStock';
import { useRecentExpenses } from '../hooks/useRecentExpenses';
import { useRecentSales } from '../hooks/useRecentSales';
import { useCurrency } from '../hooks/useCurrency';
import type { AnalyticsRange, DateRange, LowStock } from '../types';
import { addDays } from '../utils/date';
import { formatCents } from '../utils/money';
import {
  AnalyticsPreview,
  ExpensesPreview,
  InventoryPreview,
  SalesPreview,
  type PreviewState,
} from './HomeCardPreviews';
import {
  HOME_RANGES,
  homeRangeOption,
  loadHomeRange,
  saveHomeRange,
  type HomeRangeOption,
} from './homeRange';

/** How many of the latest sales and expenses their cards list. */
const RECENT_COUNT = 6;
/** The Inventory card's best and worst sellers cover this many days, up to today. */
const SELLER_DAYS = 30;
/** The Analytics card's revenue chart covers this many days, today included. */
const CHART_DAYS = 14;

/** The last `days` whole UTC days, today included, as the summary API's from/to. */
function lastDays(days: number): DateRange {
  const today = new Date().toISOString().slice(0, 10);
  return { from: addDays(today, -(days - 1)), to: today };
}

type SummaryResult = ReturnType<typeof useAnalyticsSummary>;

/** Keeps showing the last data while a reload is in flight, like the KPI strip does. */
function toPreviewState<T>(data: T | undefined, error: string | undefined): PreviewState<T> {
  if (data !== undefined) return { status: 'ready', data };
  return error ? { status: 'error' } : { status: 'loading' };
}

export function HomePage() {
  const [range, setRange] = useState<AnalyticsRange>(loadHomeRange);
  const option = homeRangeOption(range);
  // The chosen period's summary feeds the KPI strip; the Analytics card has its own two weeks.
  const summary = useAnalyticsSummary(range);
  const [chartDays] = useState(() => lastDays(CHART_DAYS));
  const chartSummary = useAnalyticsSummary(chartDays);
  const itemCount = useItemCount();
  const insights = useInventoryInsights(SELLER_DAYS);
  const recentSales = useRecentSales(RECENT_COUNT);
  const recentExpenses = useRecentExpenses(RECENT_COUNT);
  const { business } = useAuth();
  const businessName = business?.name.trim();

  function changeRange(next: AnalyticsRange) {
    setRange(next);
    saveHomeRange(next);
  }

  // `timeframe` sits at each card's top right, saying what period its preview covers.
  const dashboards = [
    {
      to: '/sales',
      title: 'Sales',
      timeframe: 'Most recent',
      preview: <SalesPreview sales={toPreviewState(recentSales.sales, recentSales.error)} />,
    },
    {
      to: '/inventory',
      title: 'Inventory',
      timeframe: `Last ${SELLER_DAYS} days`,
      preview: (
        <InventoryPreview
          days={SELLER_DAYS}
          insights={toPreviewState(insights.data, insights.error)}
          itemCount={toPreviewState(itemCount.count, itemCount.error)}
        />
      ),
    },
    {
      to: '/expenses',
      title: 'Expenses',
      timeframe: 'Most recent',
      preview: (
        <ExpensesPreview expenses={toPreviewState(recentExpenses.expenses, recentExpenses.error)} />
      ),
    },
    {
      to: '/analytics',
      title: 'Analytics',
      timeframe: `Last ${CHART_DAYS} days`,
      preview: (
        <AnalyticsPreview
          summary={toPreviewState(chartSummary.data, chartSummary.error)}
          days={CHART_DAYS}
        />
      ),
    },
  ];

  return (
    <section className="page home">
      <div className="toolbar home-header">
        <div>
          <h1 className="home-header__title">
            {businessName ? `Welcome back, ${businessName}` : 'Welcome back'}
          </h1>
          <p className="muted">Pick a dashboard to get started.</p>
        </div>
        <div className="filter-field">
          <label htmlFor="home-range">Show</label>
          <select
            id="home-range"
            value={range}
            onChange={(event) => changeRange(event.target.value as AnalyticsRange)}
          >
            {HOME_RANGES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <KpiStrip summary={summary} range={option} />
      <div className="home-cards">
        {dashboards.map(({ to, title, timeframe, preview }) => (
          <Link key={to} to={to} className="home-card">
            <div className="home-card__header">
              <h2 className="home-card__title">{title}</h2>
              <span className="home-card__timeframe">{timeframe}</span>
            </div>
            {preview}
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * Revenue / Expenses / Net Profit for the chosen period (month to date by default), plus a
 * Low stock warning. An empty period still shows $0.00, with a line saying there's nothing
 * yet, so a new account's zeros don't look broken. No comparison with the previous period
 * yet: the summary has no matching prior window, and comparing part of this month to all of
 * last month would make every tile look worse until the month ends. The two requests load
 * independently, so one failing still leaves the other's tiles showing.
 */
function KpiStrip({ summary, range }: { summary: SummaryResult; range: HomeRangeOption }) {
  const lowStock = useLowStock();
  const currency = useCurrency();

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
          message={`Couldn't load the numbers for ${range.period}: ${summary.error}`}
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
          label={`Revenue · ${range.period}`}
          value={revenue !== undefined ? formatCents(revenue, currency) : moneyPlaceholder}
          tone="neutral"
          detail={revenue === 0 ? `No sales ${range.noneYet}` : undefined}
        />
        <KpiTile
          label={`Expenses · ${range.period}`}
          value={data ? formatCents(data.totalExpensesCents, currency) : moneyPlaceholder}
          tone="neutral"
          detail={data?.totalExpensesCents === 0 ? `No expenses ${range.noneYet}` : undefined}
        />
        <KpiTile
          label={`Net Profit · ${range.period}`}
          value={netProfit !== undefined ? formatCents(netProfit, currency) : moneyPlaceholder}
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
