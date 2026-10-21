import { useState } from 'react';
import { useAnalyticsSummary } from '../../hooks/useAnalyticsSummary';
import { useInventoryByTag } from '../../hooks/useInventoryByTag';
import { formatCents } from '../../utils/money';
import { ChartLegend, DonutChart, HorizontalBarChart, LineChart, StackedBarChart } from './charts';
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
            into "Other"). "Show by" sets the time range for everything on this page except
            Inventory Overview, which always shows current stock.
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

  const topExpenseTag = topSeriesLabel(data.expenseSeries);
  const topSalesTag = data.salesByTag[0];
  const salesTotal = data.salesByTag.reduce((sum, t) => sum + t.valueCents, 0);
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
              />
              <div className="analytics-card__footer">
                <span className="muted">{axisLabel}</span>
                <ChartLegend labels={data.revenueSeries.map((s) => s.label)} />
              </div>
            </>
          )}
        </div>

        <div className="card analytics-card">
          <h2>Expenses Overview</h2>
          {data.expenseSeries.length === 0 ? (
            <p className="empty-state">No expenses in {rangeDescription(range)}.</p>
          ) : (
            <>
              {/* Same proportions as the Revenue line chart, now that they sit side by side. */}
              <StackedBarChart
                categories={data.bucketLabels}
                series={data.expenseSeries}
                width={600}
                height={230}
                ariaLabel="Expenses overview"
              />
              <ChartLegend labels={data.expenseSeries.map((s) => s.label)} />
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
        <div className="card analytics-card">
          <h2>Sales Overview</h2>
          {data.salesByTag.length === 0 ? (
            <p className="empty-state">No sales in {rangeDescription(range)}.</p>
          ) : (
            <div className="analytics-donut">
              <DonutChart
                segments={data.salesByTag.map((t) => ({ label: t.label, value: t.valueCents }))}
                ariaLabel="Sales overview by tag"
              />
              <ChartLegend labels={data.salesByTag.map((t) => t.label)} />
            </div>
          )}
          <p className="analytics-insight">
            {topSalesTag && salesTotal > 0
              ? `"${topSalesTag.label}" leads at ${Math.round((topSalesTag.valueCents / salesTotal) * 100)}% of recent sales.`
              : `No sales recorded in ${rangeDescription(range)}.`}
          </p>
        </div>

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

function topSeriesLabel(series: AnalyticsSummary['expenseSeries']): string | null {
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
