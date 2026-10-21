import type { ReactNode } from 'react';
import type { AnalyticsSummary, AnalyticsTagSeries } from '../types';
import { formatCents } from '../utils/money';
import { SERIES_COLORS } from './analytics/charts';

/**
 * Small live previews for the home page dashboard cards. They show the shape
 * of this month's data rather than repeating the KPI strip's totals. Revenue
 * is always blue and expenses always orange, here and in the Analytics charts.
 */

const REVENUE_COLOR = SERIES_COLORS[0];
const EXPENSE_COLOR = SERIES_COLORS[1];

/** What a preview has to show: still loading, failed (the strip shows the error), or data. */
export type PreviewState<T> =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T };

/** Per-bucket totals across every tag series (e.g. one revenue figure per day). */
function totalsPerBucket(series: AnalyticsTagSeries[], bucketCount: number): number[] {
  const totals = new Array<number>(bucketCount).fill(0);
  for (const s of series) s.values.forEach((value, i) => (totals[i]! += value));
  return totals;
}

function PreviewFrame({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <>
      <div className="home-card__preview">{children}</div>
      <p className="home-card__caption">{caption}</p>
    </>
  );
}

function PreviewMessage({ children }: { children: ReactNode }) {
  return <p className="home-card__message">{children}</p>;
}

/** Shared loading / error handling, so each preview only describes its ready state. */
function renderState<T>(state: PreviewState<T>, ready: (data: T) => ReactNode): ReactNode {
  if (state.status === 'loading') return <PreviewMessage>Loading…</PreviewMessage>;
  if (state.status === 'error') return <PreviewMessage>Couldn't load</PreviewMessage>;
  return ready(state.data);
}

interface SparklineSeries {
  values: number[];
  color: string;
}

const SPARK_WIDTH = 240;
const SPARK_HEIGHT = 90;
const SPARK_PAD = 8;

/**
 * Axis-free line chart for card-sized previews. All series share one y-scale
 * so they're comparable. A single point (e.g. on the 1st of the month) is drawn
 * as a dot, since there's no line to draw yet.
 */
function Sparkline({ series }: { series: SparklineSeries[] }) {
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const toPoint = (value: number, index: number, count: number) => {
    const x =
      count === 1
        ? SPARK_WIDTH / 2
        : SPARK_PAD + (index / (count - 1)) * (SPARK_WIDTH - SPARK_PAD * 2);
    const y = SPARK_HEIGHT - SPARK_PAD - (value / max) * (SPARK_HEIGHT - SPARK_PAD * 2);
    return { x, y };
  };

  return (
    <svg
      viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
      role="presentation"
      aria-hidden="true"
      className="home-card__svg"
    >
      <line
        x1={SPARK_PAD}
        y1={SPARK_HEIGHT - SPARK_PAD}
        x2={SPARK_WIDTH - SPARK_PAD}
        y2={SPARK_HEIGHT - SPARK_PAD}
        className="viz-grid"
      />
      {series.map(({ values, color }, seriesIndex) => {
        const points = values.map((value, i) => toPoint(value, i, values.length));
        if (points.length === 1) {
          return (
            <circle key={seriesIndex} cx={points[0]!.x} cy={points[0]!.y} r="4" fill={color} />
          );
        }
        return (
          <polyline
            key={seriesIndex}
            points={points.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
}

/** Sales: daily revenue so far this month. */
export function SalesPreview({ summary }: { summary: PreviewState<AnalyticsSummary> }) {
  return (
    <PreviewFrame caption="Daily revenue, this month">
      {renderState(summary, (data) =>
        data.totalRevenueCents === 0 ? (
          <PreviewMessage>No sales yet this month</PreviewMessage>
        ) : (
          <Sparkline
            series={[
              {
                values: totalsPerBucket(data.revenueSeries, data.buckets.length),
                color: REVENUE_COLOR,
              },
            ]}
          />
        ),
      )}
    </PreviewFrame>
  );
}

/** Expenses: the top categories (first tag) this month, as proportional bars. */
export function ExpensesPreview({ summary }: { summary: PreviewState<AnalyticsSummary> }) {
  return (
    <PreviewFrame caption="Top expense categories, this month">
      {renderState(summary, (data) => {
        // The server already keeps the top 3 tags and folds the rest into "Other".
        const categories = data.expenseSeries
          .map((s) => ({ label: s.label, total: s.values.reduce((sum, v) => sum + v, 0) }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 3);
        if (categories.length === 0) {
          return <PreviewMessage>No expenses yet this month</PreviewMessage>;
        }
        const max = categories[0]!.total;
        return (
          <ul className="home-bars">
            {categories.map(({ label, total }) => (
              <li key={label} className="home-bars__row">
                <span className="home-bars__label">{label}</span>
                <span className="home-bars__track">
                  <span
                    className="home-bars__fill"
                    style={{ width: `${(total / max) * 100}%`, background: EXPENSE_COLOR }}
                  />
                </span>
                <span className="home-bars__value">{formatCents(total)}</span>
              </li>
            ))}
          </ul>
        );
      })}
    </PreviewFrame>
  );
}

/** Analytics: daily revenue vs expenses on one scale. */
export function AnalyticsPreview({ summary }: { summary: PreviewState<AnalyticsSummary> }) {
  return (
    <PreviewFrame caption="Revenue vs expenses, this month">
      {renderState(summary, (data) =>
        data.totalRevenueCents === 0 && data.totalExpensesCents === 0 ? (
          <PreviewMessage>Nothing recorded yet this month</PreviewMessage>
        ) : (
          <>
            <Sparkline
              series={[
                {
                  values: totalsPerBucket(data.revenueSeries, data.buckets.length),
                  color: REVENUE_COLOR,
                },
                {
                  values: totalsPerBucket(data.expenseSeries, data.buckets.length),
                  color: EXPENSE_COLOR,
                },
              ]}
            />
            <div className="home-legend">
              <span>
                <span className="home-legend__swatch" style={{ background: REVENUE_COLOR }} />
                Revenue
              </span>
              <span>
                <span className="home-legend__swatch" style={{ background: EXPENSE_COLOR }} />
                Expenses
              </span>
            </div>
          </>
        ),
      )}
    </PreviewFrame>
  );
}

/** Inventory: how many products are being tracked. */
export function InventoryPreview({ itemCount }: { itemCount: PreviewState<number> }) {
  return (
    <PreviewFrame caption="Products in inventory">
      {renderState(itemCount, (count) =>
        count === 0 ? (
          <PreviewMessage>No products yet</PreviewMessage>
        ) : (
          <p className="home-card__number">
            {count} {count === 1 ? 'product' : 'products'}
          </p>
        ),
      )}
    </PreviewFrame>
  );
}
