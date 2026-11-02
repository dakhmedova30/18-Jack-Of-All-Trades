import { useState } from 'react';
import { useAnalyticsDateRange } from '../../hooks/useAnalyticsDateRange';
import { useAnalyticsSummary } from '../../hooks/useAnalyticsSummary';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useInventoryByTag } from '../../hooks/useInventoryByTag';
import { formatDate, startOfMonth } from '../../utils/date';
import { formatCents, formatCentsCompact } from '../../utils/money';
import { AnalyticsFilters } from './AnalyticsFilters';
import {
  ChartLegend,
  DonutChart,
  HorizontalBarChart,
  LineChart,
  type DonutSegment,
} from './charts';
import type { AnalyticsDateRange, AnalyticsSummary, DateRange } from '../../types';

/** How long the period must stay still (e.g. while dragging the slider) before it reloads. */
const RELOAD_DELAY_MS = 250;

const AXIS_LABELS: Record<AnalyticsSummary['granularity'], string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
};

/**
 * The period the page opens with: the 12 calendar months up to the latest record (like the old
 * "12 months" default), starting no earlier than the first record. With no records yet, the 12
 * months up to today.
 */
function defaultPeriod({ firstDate, lastDate, today }: AnalyticsDateRange): DateRange {
  const to = lastDate ?? today;
  const yearBack = startOfMonth(to, -11);
  return { from: firstDate && firstDate > yearBack ? firstDate : yearBack, to };
}

/** "from Aug 1, 2025 to Oct 29, 2026" (or "on Oct 29, 2026"), for empty states and insights. */
function periodPhrase({ from, to }: DateRange): string {
  return from === to ? `on ${formatDate(from)}` : `from ${formatDate(from)} to ${formatDate(to)}`;
}

function AnalyticsHeader() {
  return (
    <div className="analytics-header">
      <div>
        <h1>Analytics</h1>
        <p className="muted">
          Revenue, expenses and sales group by each record's first tag (top 3, the rest folded into
          "Other"). The date filter sets the period for everything here except Inventory Overview,
          which always shows current stock.
        </p>
      </div>
    </div>
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

/** The dashboard and its filter side bar, once the first and last record dates are known. */
function AnalyticsDashboard({ dates }: { dates: AnalyticsDateRange }) {
  const initial = defaultPeriod(dates);
  const [period, setPeriod] = useState<DateRange>(initial);
  // Dragging the slider changes the period many times a second; load only where it settles.
  const requested = useDebouncedValue(period, RELOAD_DELAY_MS);
  const { data, error, loading, reload } = useAnalyticsSummary(requested);
  const refreshing = data !== undefined && (loading || requested !== period);

  return (
    <>
      <AnalyticsHeader />

      <div className="analytics-layout">
        <AnalyticsFilters
          dates={dates}
          value={period}
          onChange={setPeriod}
          onReset={() => setPeriod(initial)}
          isDefault={period.from === initial.from && period.to === initial.to}
        />

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

          <div className="analytics-row">
            <BreakdownCard data={data} period={requested} refreshing={refreshing} error={error} />

            <InventoryOverview />
          </div>
        </div>
      </div>
    </>
  );
}

interface AnalyticsContentProps {
  data: AnalyticsSummary;
  /** The period `data` was loaded for. */
  period: DateRange;
}

/** The totals and the two overview charts: everything the date filter moves. */
function AnalyticsContent({ data, period }: AnalyticsContentProps) {
  const netProfitTone = data.netProfitCents >= 0 ? 'positive' : 'negative';
  const phrase = periodPhrase(period);

  const topRevenueTag = topSeriesLabel(data.revenueSeries);
  const topExpenseTag = topSeriesLabel(data.expenseSeries);
  const axisLabel = AXIS_LABELS[data.granularity];

  return (
    <>
      <div className="analytics-stats">
        <StatCard
          label="Net Profit"
          value={formatCents(data.netProfitCents)}
          tone={netProfitTone}
        />
        <StatCard
          label="Total Revenue"
          value={formatCents(data.totalRevenueCents)}
          tone="neutral"
        />
        <StatCard
          label="Total Expenses"
          value={formatCents(data.totalExpensesCents)}
          tone="neutral"
        />
      </div>

      <div className="analytics-row">
        <div className="card analytics-card">
          <h2>Revenue Overview</h2>
          {data.revenueSeries.length === 0 ? (
            <p className="empty-state">No sales {phrase}.</p>
          ) : (
            <>
              <LineChart
                categories={data.bucketLabels}
                series={data.revenueSeries}
                ariaLabel="Revenue overview"
                height={190}
                formatValue={formatCentsCompact}
                formatTooltip={formatCents}
              />
              <div className="analytics-card__footer">
                <span className="muted">{axisLabel}</span>
                <ChartLegend labels={data.revenueSeries.map((s) => s.label)} />
              </div>
            </>
          )}
          {/* Mirrors the Expenses note, which also keeps the two charts the same size. */}
          <p className="analytics-insight">
            {topRevenueTag
              ? `"${topRevenueTag}" is your top revenue category ${phrase}.`
              : `No sales recorded ${phrase}.`}
          </p>
        </div>

        <div className="card analytics-card">
          <h2>Expenses Overview</h2>
          {data.expenseSeries.length === 0 ? (
            <p className="empty-state">No expenses {phrase}.</p>
          ) : (
            <>
              <LineChart
                categories={data.bucketLabels}
                series={data.expenseSeries}
                ariaLabel="Expenses overview"
                height={190}
                formatValue={formatCentsCompact}
                formatTooltip={formatCents}
              />
              <div className="analytics-card__footer">
                <span className="muted">{axisLabel}</span>
                <ChartLegend labels={data.expenseSeries.map((s) => s.label)} />
              </div>
            </>
          )}
          <p className="analytics-insight">
            {topExpenseTag
              ? `"${topExpenseTag}" is your biggest expense category ${phrase}.`
              : `No expenses recorded ${phrase}.`}
          </p>
        </div>
      </div>
    </>
  );
}

/**
 * Current stock (units) by first tag. Loads separately from the summary since
 * it's a snapshot that the date filter doesn't affect, so changing the period
 * doesn't refetch it.
 */
function InventoryOverview() {
  const { data, error, loading, reload } = useInventoryByTag();
  const top = data?.byTag[0];

  return (
    <div className="card analytics-card">
      <h2>Inventory Overview</h2>
      {error ? (
        <p className="empty-state">
          Couldn't load inventory: {error}{' '}
          <button type="button" className="link-button" onClick={reload}>
            Retry
          </button>
        </p>
      ) : !data ? (
        <p className="empty-state">{loading ? 'Loading inventory…' : 'No inventory data.'}</p>
      ) : data.totalItems === 0 ? (
        <p className="empty-state">No products in inventory yet.</p>
      ) : (
        <>
          <HorizontalBarChart
            bars={data.byTag.map((t) => ({
              label: t.label,
              value: t.quantity,
              detail: `${t.itemCount} ${t.itemCount === 1 ? 'product' : 'products'}`,
            }))}
            unit="units"
            ariaLabel="Units in stock by tag"
          />
          <div className="analytics-card__footer">
            <span className="muted">Units in stock</span>
          </div>
        </>
      )}
      <p className="analytics-insight">
        {data && top && data.totalQuantity > 0
          ? `${data.totalQuantity.toLocaleString()} units across ${data.totalItems} products; "${top.label}" holds the most stock (${Math.round((top.quantity / data.totalQuantity) * 100)}%).`
          : 'Current stock, not affected by the date filter.'}
      </p>
    </div>
  );
}

/**
 * Each tag's total over the whole period, in the series' own order. Keeping that order keeps
 * each tag's colour the same as in the overview charts. Tags that add up to nothing are dropped.
 */
function periodTotals(series: AnalyticsSummary['revenueSeries']): DonutSegment[] {
  return series
    .map((s) => ({ label: s.label, value: s.values.reduce((sum, v) => sum + v, 0) }))
    .filter((s) => s.value > 0);
}

interface BreakdownCardProps {
  /** The page's summary for the filtered period; undefined until it first loads. */
  data: AnalyticsSummary | undefined;
  period: DateRange;
  /** A new period is loading, so `data` is about to change. */
  refreshing: boolean;
  /** Why the summary didn't load (the page shows it, with Retry, above). */
  error: string | undefined;
}

/**
 * Sales and expense pies for the filtered period: each tag's share of its totals. The tags (top
 * 3 plus "Other") are the overview charts' own, so a tag reads the same everywhere on the page.
 */
function BreakdownCard({ data, period, refreshing, error }: BreakdownCardProps) {
  const sales = data ? periodTotals(data.revenueSeries) : [];
  const expenses = data ? periodTotals(data.expenseSeries) : [];
  const phrase = periodPhrase(period);
  const insight = [
    breakdownInsight(sales, 'leads sales at', `No sales ${phrase}.`),
    breakdownInsight(expenses, 'is', `No expenses ${phrase}.`, 'of expenses'),
  ].join(' ');

  return (
    <div className={`card analytics-card${refreshing ? ' is-loading' : ''}`} aria-busy={refreshing}>
      <h2>Revenue &amp; Expense Breakdown</h2>
      {!data ? (
        <p className="empty-state">
          {error ? "Couldn't load the breakdown." : 'Loading breakdown…'}
        </p>
      ) : (
        <>
          <div className="analytics-donuts">
            <BreakdownDonut title="Sales" segments={sales} emptyText="No sales in this period." />
            <BreakdownDonut
              title="Expenses"
              segments={expenses}
              emptyText="No expenses in this period."
            />
          </div>
          <p className="analytics-insight">{insight}</p>
        </>
      )}
    </div>
  );
}

/** '"Bathroom" leads sales at 59%.' for the largest segment, or `emptyText`. */
function breakdownInsight(
  segments: DonutSegment[],
  verb: string,
  emptyText: string,
  suffix = '',
): string {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const top = [...segments].sort((a, b) => b.value - a.value)[0];
  if (!top || total === 0) return emptyText;
  return `"${top.label}" ${verb} ${percentOf(top.value, total)}%${suffix ? ` ${suffix}` : ''}.`;
}

function percentOf(part: number, total: number): number {
  return Math.round((part / total) * 100);
}

interface BreakdownDonutProps {
  title: string;
  segments: DonutSegment[];
  emptyText: string;
}

/** One half of the breakdown card: a titled donut with its own legend. */
function BreakdownDonut({ title, segments, emptyText }: BreakdownDonutProps) {
  return (
    <div className="analytics-donut-panel">
      <h3 className="analytics-donut-panel__title">{title}</h3>
      {segments.length === 0 ? (
        <p className="empty-state">{emptyText}</p>
      ) : (
        <div className="analytics-donut">
          <DonutChart segments={segments} ariaLabel={`${title} by tag`} />
          <ChartLegend labels={segments.map((s) => s.label)} />
        </div>
      )}
    </div>
  );
}

function topSeriesLabel(series: AnalyticsSummary['revenueSeries']): string | null {
  if (series.length === 0) return null;
  const totals = series.map((s) => ({
    label: s.label,
    total: s.values.reduce((sum, v) => sum + v, 0),
  }));
  return totals.reduce((top, s) => (s.total > top.total ? s : top)).label;
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
