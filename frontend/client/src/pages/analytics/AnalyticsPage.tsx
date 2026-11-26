import type { ReactNode } from 'react';
import { useState } from 'react';
import { getAnalyticsSummary, getInventoryByTag } from '../../api/analytics';
import { CsvTransfer } from '../../components/CsvTransfer';
import { Link } from 'react-router-dom';
import { useAnalyticsDateRange } from '../../hooks/useAnalyticsDateRange';
import { useAnalyticsSummary } from '../../hooks/useAnalyticsSummary';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useCurrency } from '../../hooks/useCurrency';
import { formatCents, formatCentsCompact } from '../../utils/money';
import { AnalyticsFilters } from './AnalyticsFilters';
import { defaultPeriod, periodPhrase, RELOAD_DELAY_MS } from './analyticsPeriod';
import { ANALYTICS_SECTIONS } from './analyticsSections';
import { ChartCard, FitSize } from './ChartCard';
import { ChartLegend, ChartTable, CompactBarList, LineChart } from './charts';
import type { AnalyticsDateRange, AnalyticsSummary, DateRange, InventoryByTag } from '../../types';

const BY_BUCKET: Record<AnalyticsSummary['granularity'], string> = {
  day: 'By day',
  week: 'By week',
  month: 'By month',
};

const REVENUE = 'Total Revenue';
const EXPENSES = 'Total Expenses';

function percentOf(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

/** Every series added up bucket by bucket: the revenue or expense total for each bucket. */
function totalsByBucket(series: AnalyticsSummary['revenueSeries'], buckets: number): number[] {
  return Array.from({ length: buckets }, (_, i) =>
    series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0),
  );
}

function AnalyticsHeader({ actions }: { actions?: ReactNode }) {
  return (
    <>
      <div className="analytics-header">
        <div className="analytics-header__description">
          <h1>Analytics</h1>
          <p className="muted">
            Revenue, expenses and profit over the period you choose, where your revenue comes from
            by sales channel, and where your expenses go by tag.
          </p>
        </div>
        {actions && <div className="analytics-header__actions">{actions}</div>}
      </div>
      <nav className="analytics-sections" aria-label="Deeper analytics">
        {ANALYTICS_SECTIONS.map(({ to, title, description, icon: SectionIcon }) => (
          <Link key={to} to={to} className="analytics-section-link">
            <SectionIcon />
            <span>
              <span className="analytics-section-link__title">{title}</span>
              <span className="analytics-section-link__text">{description}</span>
            </span>
          </Link>
        ))}
      </nav>
    </>
  );
}

export function AnalyticsPage() {
  const { data: dates, error, reload } = useAnalyticsDateRange();

  return (
    <section className="page">
      {dates ? (
        <AnalyticsDashboard dates={dates} />
      ) : (
        <>
          <AnalyticsHeader />
          {error ? (
            <div className="banner banner--error" role="alert">
              {error}{' '}
              <button type="button" className="link-button" onClick={reload}>
                Retry
              </button>
            </div>
          ) : (
            <p className="empty-state">Loading analytics…</p>
          )}
        </>
      )}
    </section>
  );
}

/** The dashboard and its side bar (the date filter, then the two breakdowns), once the record dates are known. */
function AnalyticsDashboard({ dates }: { dates: AnalyticsDateRange }) {
  const initial = defaultPeriod(dates);
  const [period, setPeriod] = useState<DateRange>(initial);
  // Dragging the slider changes the period many times a second; load only where it settles.
  const requested = useDebouncedValue(period, RELOAD_DELAY_MS);
  const { data, error, loading, reload } = useAnalyticsSummary(requested);
  const refreshing = data !== undefined && (loading || requested !== period);
  const phrase = periodPhrase(requested);

  async function loadAnalyticsCsv(): Promise<AnalyticsCsvRecord[]> {
    const [summary, inventory] = await Promise.all([
      getAnalyticsSummary(requested),
      getInventoryByTag(),
    ]);
    // This page no longer filters by channel, so channelId is always blank; the column stays so
    // exports keep the same layout.
    return [{ from: requested.from, to: requested.to, channelId: '', summary, inventory }];
  }

  return (
    <>
      <AnalyticsHeader
        actions={
          <CsvTransfer
            filename="analytics"
            headers={ANALYTICS_CSV_HEADERS}
            loadRows={loadAnalyticsCsv}
            exportRow={analyticsCsvRow}
          />
        }
      />

      <div className="analytics-layout">
        <div className="analytics-side">
          <AnalyticsFilters
            dates={dates}
            value={period}
            onChange={setPeriod}
            onReset={() => setPeriod(initial)}
            isDefault={period.from === initial.from && period.to === initial.to}
          />

          <SideBreakdownCard
            title="Revenue by Channel"
            totals={data?.revenueByChannel}
            ariaLabel="Revenue by sales channel"
            share="of revenue"
            loadingText="Loading channels…"
            emptyText={`No sales ${phrase}.`}
            topInsight={(label, percent) =>
              `"${label}" brings in the most revenue ${phrase} (${percent}%).`
            }
            refreshing={refreshing}
            error={error}
          />

          <SideBreakdownCard
            title="Expenses by Tag"
            totals={data?.expensesByTag}
            ariaLabel="Expenses by tag"
            share="of expenses"
            loadingText="Loading tags…"
            emptyText={`No expenses ${phrase}.`}
            topInsight={(label, percent) =>
              `"${label}" is your biggest expense ${phrase} (${percent}%).`
            }
            refreshing={refreshing}
            error={error}
          />
        </div>

        <div className="analytics-main">
          {error && (
            <div className="banner banner--error" role="alert">
              {error}{' '}
              <button type="button" className="link-button" onClick={reload}>
                Retry
              </button>
            </div>
          )}

          {loading && !data && <p className="empty-state">Loading analytics…</p>}

          {data && (
            <div
              className={`analytics-body${refreshing ? ' is-loading' : ''}`}
              aria-busy={refreshing}
            >
              <AnalyticsContent data={data} period={requested} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

interface AnalyticsCsvRecord {
  from: string;
  to: string;
  channelId: string;
  summary: AnalyticsSummary;
  inventory: InventoryByTag;
}

const ANALYTICS_CSV_HEADERS = [
  'from',
  'to',
  'channelId',
  'totalRevenueCents',
  'totalExpensesCents',
  'netProfitCents',
  'range',
  'granularity',
  'buckets',
  'bucketLabels',
  'revenueSeries',
  'expenseSeries',
  'salesByTag',
  'revenueByChannel',
  'inventoryByTag',
  'inventoryTotalQuantity',
  'inventoryTotalItems',
];

function analyticsCsvRow({ from, to, channelId, summary, inventory }: AnalyticsCsvRecord) {
  return [
    from,
    to,
    channelId,
    summary.totalRevenueCents,
    summary.totalExpensesCents,
    channelId ? null : summary.netProfitCents,
    summary.range,
    summary.granularity,
    JSON.stringify(summary.buckets),
    JSON.stringify(summary.bucketLabels),
    JSON.stringify(summary.revenueSeries),
    JSON.stringify(summary.expenseSeries),
    JSON.stringify(summary.salesByTag),
    JSON.stringify(summary.revenueByChannel),
    JSON.stringify(inventory.byTag),
    inventory.totalQuantity,
    inventory.totalItems,
  ];
}

interface AnalyticsContentProps {
  data: AnalyticsSummary;
  /** The period `data` was loaded for. */
  period: DateRange;
}

/** The totals, then revenue and expenses as two lines on one chart. */
function AnalyticsContent({ data, period }: AnalyticsContentProps) {
  const currency = useCurrency();
  const money = (cents: number) => formatCents(cents, currency);
  const compact = (cents: number) => formatCentsCompact(cents, currency);
  const phrase = periodPhrase(period);
  const revenue = totalsByBucket(data.revenueSeries, data.buckets.length);
  const expenses = totalsByBucket(data.expenseSeries, data.buckets.length);
  const hasRecords = data.revenueSeries.length > 0 || data.expenseSeries.length > 0;

  // With no records the empty state already says so, so there's no insight to add.
  const insight = !hasRecords
    ? undefined
    : data.totalRevenueCents > 0
      ? `Expenses came to ${percentOf(data.totalExpensesCents, data.totalRevenueCents)}% of revenue ${phrase}.`
      : `No revenue ${phrase} to set against ${money(data.totalExpensesCents)} of expenses.`;

  return (
    <>
      <div className="analytics-stats">
        <StatCard
          label="Net Profit"
          value={money(data.netProfitCents)}
          tone={data.netProfitCents >= 0 ? 'positive' : 'negative'}
        />
        <StatCard label="Total Revenue" value={money(data.totalRevenueCents)} tone="neutral" />
        <StatCard label="Total Expenses" value={money(data.totalExpensesCents)} tone="neutral" />
      </div>

      {/* Fills the height the side cards give it, so the chart ends level with them. */}
      <ChartCard
        title="Revenue & Expenses Overview"
        context={BY_BUCKET[data.granularity]}
        insight={insight}
        fill
      >
        {!hasRecords ? (
          <p className="empty-state">No sales or expenses {phrase}.</p>
        ) : (
          <>
            <FitSize fallback={{ width: 840, height: 300 }}>
              {(width, height) => (
                <LineChart
                  categories={data.bucketLabels}
                  series={[
                    { label: REVENUE, values: revenue },
                    { label: EXPENSES, values: expenses },
                  ]}
                  ariaLabel="Total revenue and total expenses"
                  width={width}
                  height={height}
                  formatValue={compact}
                  formatTooltip={money}
                />
              )}
            </FitSize>
            <div className="analytics-card__footer">
              <ChartLegend labels={[REVENUE, EXPENSES]} />
            </div>
            <ChartTable
              columns={['Period', 'Revenue', 'Expenses']}
              rows={data.bucketLabels.map((label, i) => [
                label,
                money(revenue[i]!),
                money(expenses[i]!),
              ])}
            />
          </>
        )}
      </ChartCard>
    </>
  );
}

interface SideBreakdownCardProps {
  title: string;
  /** Largest first; undefined until the summary first loads. */
  totals: AnalyticsSummary['revenueByChannel'] | undefined;
  ariaLabel: string;
  /** What each bar is a share of, for its hover text: "of revenue". */
  share: string;
  loadingText: string;
  emptyText: string;
  /** The insight for the largest entry, given its label and share. */
  topInsight: (label: string, percent: number) => string;
  /** A new period is loading, so `totals` is about to change. */
  refreshing: boolean;
  /** Why the summary didn't load (the page shows it, with Retry, beside this). */
  error: string | undefined;
}

/**
 * One bar per entry (a sales channel, or an expense tag) with money in the period, in the side
 * bar under the filters. It dims on its own while a new period loads.
 */
function SideBreakdownCard({
  title,
  totals,
  ariaLabel,
  share,
  loadingText,
  emptyText,
  topInsight,
  refreshing,
  error,
}: SideBreakdownCardProps) {
  const currency = useCurrency();
  const total = (totals ?? []).reduce((sum, entry) => sum + entry.valueCents, 0);
  const top = totals?.[0];

  return (
    <div
      className={`card analytics-card analytics-card--side${refreshing ? ' is-loading' : ''}`}
      aria-busy={refreshing}
    >
      <h2>{title}</h2>
      {!totals ? (
        <p className="empty-state">
          {error ? `Couldn't load ${title.toLowerCase()}.` : loadingText}
        </p>
      ) : (
        <>
          {totals.length === 0 ? (
            <p className="empty-state">{emptyText}</p>
          ) : (
            <CompactBarList
              bars={totals.map((entry) => ({
                label: entry.label,
                value: entry.valueCents,
                detail: `${percentOf(entry.valueCents, total)}% ${share}`,
              }))}
              ariaLabel={ariaLabel}
              formatValue={(cents) => formatCentsCompact(cents, currency)}
              formatTooltip={(cents) => formatCents(cents, currency)}
            />
          )}
          {top && total > 0 && (
            <p className="analytics-insight">
              {topInsight(top.label, percentOf(top.valueCents, total))}
            </p>
          )}
        </>
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  tone: 'positive' | 'negative' | 'neutral';
}

function StatCard({ label, value, tone }: StatCardProps) {
  return (
    <div className={`stat-card stat-card--${tone}`}>
      <span className="stat-card__label">{label}</span>
      <span className="stat-card__value">{value}</span>
    </div>
  );
}
