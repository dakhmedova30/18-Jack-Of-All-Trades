import { useState } from 'react';
import { useAnalyticsSummary } from '../../hooks/useAnalyticsSummary';
import { useInventoryByTag } from '../../hooks/useInventoryByTag';
import { formatCents, formatCentsCompact } from '../../utils/money';
import {
  ChartLegend,
  DonutChart,
  HorizontalBarChart,
  LineChart,
  type DonutSegment,
} from './charts';
import type { AnalyticsRange, AnalyticsSummary } from '../../types';

const RANGE_OPTIONS: { value: AnalyticsRange; label: string }[] = [
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Month' },
  { value: 'ytd', label: 'Year to date' },
  { value: '12months', label: '12 months' },
];
const DEFAULT_RANGE: AnalyticsRange = '12months';

/** Human phrase for the range, used in empty-state/insight copy ("No sales in {phrase}"). */
function rangeDescription(range: AnalyticsRange): string {
  switch (range) {
    case 'week':
      return 'the last 7 days';
    case 'month':
      return 'this month so far';
    case 'ytd':
      return 'this year so far';
    case '12months':
      return 'the last 12 months';
  }
}

export function AnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRange>(DEFAULT_RANGE);
  const { data, error, loading, reload } = useAnalyticsSummary(range);

  return (
    <section className="page">
      <div className="analytics-header">
        <div>
          <h1>Analytics</h1>
          <p className="muted">
            Revenue, expenses and sales group by each record's first tag (top 3, the rest folded
            into "Other"). "Show by" sets the time range for everything on this page except the
            Breakdown, which has its own month picker, and Inventory Overview, which always shows
            current stock.
          </p>
        </div>
        <label className="analytics-select">
          Show by
          <select
            value={range}
            onChange={(event) => setRange(event.target.value as AnalyticsRange)}
            aria-label="Time range for the whole dashboard"
          >
            {RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div className="banner banner--error" role="alert">
          {error}{' '}
          <button type="button" className="link-button" onClick={reload}>
            Retry
          </button>
        </div>
      )}

      {loading && !data && <p className="empty-state">Loading analytics…</p>}

      {data && <AnalyticsContent data={data} range={range} />}
    </section>
  );
}

interface AnalyticsContentProps {
  data: AnalyticsSummary;
  range: AnalyticsRange;
}

function AnalyticsContent({ data, range }: AnalyticsContentProps) {
  const netProfitTone = data.netProfitCents >= 0 ? 'positive' : 'negative';

  const topRevenueTag = topSeriesLabel(data.revenueSeries);
  const topExpenseTag = topSeriesLabel(data.expenseSeries);
  const axisLabel = data.granularity === 'day' ? 'Day' : 'Month';

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
            <p className="empty-state">No sales in {rangeDescription(range)}.</p>
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
              ? `"${topRevenueTag}" is your top revenue category in ${rangeDescription(range)}.`
              : `No sales recorded in ${rangeDescription(range)}.`}
          </p>
        </div>

        <div className="card analytics-card">
          <h2>Expenses Overview</h2>
          {data.expenseSeries.length === 0 ? (
            <p className="empty-state">No expenses in {rangeDescription(range)}.</p>
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
              ? `"${topExpenseTag}" is your biggest expense category in ${rangeDescription(range)}.`
              : `No expenses recorded in ${rangeDescription(range)}.`}
          </p>
        </div>
      </div>

      <div className="analytics-row">
        <BreakdownCard />

        <InventoryOverview />
      </div>
    </>
  );
}

/**
 * Current stock (units) by first tag. Loads separately from the summary since
 * it's a snapshot that "Show by" doesn't affect, so changing the range doesn't
 * refetch it.
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
          : 'Current stock, not affected by "Show by".'}
      </p>
    </div>
  );
}

/** "2026-10" -> "Oct 2026" */
function formatMonthKey(key: string): string {
  return new Date(`${key}-01T00:00:00Z`).toLocaleDateString('en-CA', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Per-tag totals for one bucket of a tag series, dropping tags with nothing that month. */
function segmentsAt(series: AnalyticsSummary['revenueSeries'], index: number): DonutSegment[] {
  return series
    .map((s) => ({ label: s.label, value: s.values[index] ?? 0 }))
    .filter((s) => s.value > 0);
}

/**
 * Sales and expense pies for one chosen month (current month by default), out
 * of the last 12. Has its own month picker and loads the 12-month summary
 * itself, so the page-wide "Show by" doesn't affect it. Tags are the top 3
 * across those 12 months (the rest in "Other"), so a tag keeps the same
 * meaning whichever month is picked.
 */
function BreakdownCard() {
  const { data, error, loading, reload } = useAnalyticsSummary('12months');
  const [pickedMonth, setPickedMonth] = useState<string | null>(null);

  const months = data?.buckets ?? [];
  // Default (and fallback, e.g. after the month rolls over): the latest month.
  const month = pickedMonth && months.includes(pickedMonth) ? pickedMonth : months.at(-1);
  const index = month ? months.indexOf(month) : -1;
  const monthLabel = month ? formatMonthKey(month) : '';

  const sales = data && index >= 0 ? segmentsAt(data.revenueSeries, index) : [];
  const expenses = data && index >= 0 ? segmentsAt(data.expenseSeries, index) : [];
  const insight = [
    breakdownInsight(sales, 'leads sales at', `No sales in ${monthLabel}.`),
    breakdownInsight(expenses, 'is', `No expenses in ${monthLabel}.`, 'of expenses'),
  ].join(' ');

  return (
    <div className="card analytics-card">
      <div className="analytics-card__header">
        <h2>Revenue &amp; Expense Breakdown</h2>
        {months.length > 0 && (
          <label className="analytics-select">
            Month
            <select
              value={month}
              onChange={(event) => setPickedMonth(event.target.value)}
              aria-label="Month for the sales and expense breakdown"
            >
              {[...months].reverse().map((key) => (
                <option key={key} value={key}>
                  {formatMonthKey(key)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {error ? (
        <p className="empty-state">
          Couldn't load the breakdown: {error}{' '}
          <button type="button" className="link-button" onClick={reload}>
            Retry
          </button>
        </p>
      ) : !data ? (
        <p className="empty-state">{loading ? 'Loading breakdown…' : 'No data.'}</p>
      ) : (
        <>
          <div className="analytics-donuts">
            <BreakdownDonut
              title="Sales"
              segments={sales}
              emptyText={`No sales in ${monthLabel}.`}
            />
            <BreakdownDonut
              title="Expenses"
              segments={expenses}
              emptyText={`No expenses in ${monthLabel}.`}
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
