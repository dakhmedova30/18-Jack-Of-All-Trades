import type { ReactNode } from 'react';
import type { AnalyticsSummary, Expense, InventoryInsights, Sale } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { usePreferences } from '../hooks/usePreferences';
import { formatCents, formatCentsCompact } from '../utils/money';
import { ChartLegend, LineChart } from './analytics/charts';

/**
 * The live previews inside the home page's four dashboard cards: the latest sales, the recent
 * best and worst sellers, the latest expenses, and the revenue overview chart. What period each
 * covers is shown at the card's top right, so the previews have no captions of their own.
 */

/** What a preview has to show: still loading, failed, or data. */
export type PreviewState<T> =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T };

function PreviewFrame({ children }: { children: ReactNode }) {
  return <div className="home-card__preview">{children}</div>;
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

const NAMED_PER_ROW = 2;

/** "Ceramic planter ×2, Soap +1 more": the first few names, the rest counted. */
function describeLines(lines: { itemName: string; quantity: number }[]): string {
  const named = lines
    .slice(0, NAMED_PER_ROW)
    .map((line) => (line.quantity > 1 ? `${line.itemName} ×${line.quantity}` : line.itemName))
    .join(', ');
  const remaining = lines.length - NAMED_PER_ROW;
  return remaining > 0 ? `${named} +${remaining} more` : named;
}

interface ActivityRow {
  id: number;
  date: string;
  label: string;
  amount: string;
}

/** Date, what it was, and the amount: one line each, for the Sales and Expenses cards. */
function ActivityList({ rows, tone }: { rows: ActivityRow[]; tone: 'income' | 'cost' }) {
  return (
    <ul className="home-activity">
      {rows.map((row) => (
        <li key={row.id} className="home-activity__row">
          <span className="home-activity__date">{row.date}</span>
          <span className="home-activity__label">{row.label}</span>
          <span className={`home-activity__amount home-activity__amount--${tone}`}>
            {row.amount}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Sales: the latest few sales, newest first. */
export function SalesPreview({ sales }: { sales: PreviewState<Sale[]> }) {
  const { formatDate } = usePreferences();
  const currency = useCurrency();
  return (
    <PreviewFrame>
      {renderState(sales, (list) =>
        list.length === 0 ? (
          <PreviewMessage>No sales recorded yet</PreviewMessage>
        ) : (
          <ActivityList
            tone="income"
            rows={list.map((sale) => ({
              id: sale.id,
              date: formatDate(sale.soldAt),
              label: sale.description || describeLines(sale.items) || 'Sale',
              amount: `+${formatCents(sale.totalCents, currency)}`,
            }))}
          />
        ),
      )}
    </PreviewFrame>
  );
}

/** Expenses: the latest few expenses and what each cost, newest first. */
export function ExpensesPreview({ expenses }: { expenses: PreviewState<Expense[]> }) {
  const { formatDate } = usePreferences();
  const currency = useCurrency();
  return (
    <PreviewFrame>
      {renderState(expenses, (list) =>
        list.length === 0 ? (
          <PreviewMessage>No expenses recorded yet</PreviewMessage>
        ) : (
          <ActivityList
            tone="cost"
            rows={list.map((expense) => ({
              id: expense.id,
              date: formatDate(expense.incurredAt),
              label: expense.description || describeLines(expense.items) || 'Expense',
              amount: `−${formatCents(expense.totalCents, currency)}`,
            }))}
          />
        ),
      )}
    </PreviewFrame>
  );
}

interface SellerSummary {
  name: string;
  detail: string;
}

const unitsSold = (units: number) => `${units} sold`;

/**
 * The worst seller in the insights' period. An in-stock item that hasn't sold at all is worse than anything
 * that sold, so the one with the most stock sitting unsold comes first; otherwise it's whatever
 * sold the fewest units, unless that's also the best seller (only one item sold).
 */
export function worstSeller(insights: InventoryInsights): SellerSummary | null {
  const unsold = [...insights.notSelling].sort(
    (a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name),
  )[0];
  if (unsold) return { name: unsold.name, detail: `0 sold · ${unsold.quantity} in stock` };
  const worst = insights.worstSeller;
  if (!worst || worst.id === insights.bestSellers[0]?.id) return null;
  return { name: worst.name, detail: unitsSold(worst.unitsSold) };
}

function SellerRow({
  kind,
  seller,
  empty,
}: {
  kind: 'best' | 'worst';
  seller: SellerSummary | null;
  empty: string;
}) {
  return (
    <div className={`home-seller home-seller--${kind}`}>
      <span className="home-seller__kind">{kind === 'best' ? 'Best seller' : 'Worst seller'}</span>
      {seller ? (
        <>
          <span className="home-seller__name">{seller.name}</span>
          <span className="home-seller__detail">{seller.detail}</span>
        </>
      ) : (
        <span className="home-seller__detail">{empty}</span>
      )}
    </div>
  );
}

/** Inventory: the last `days` days' best seller (green) and worst seller (red), and the product count. */
export function InventoryPreview({
  days,
  insights,
  itemCount,
}: {
  days: number;
  insights: PreviewState<InventoryInsights>;
  itemCount: PreviewState<number>;
}) {
  const count = itemCount.status === 'ready' ? itemCount.data : undefined;
  return (
    <PreviewFrame>
      {renderState(insights, (data) => {
        if (count === 0) return <PreviewMessage>No products yet</PreviewMessage>;
        const best = data.bestSellers[0];
        return (
          <div className="home-sellers">
            <SellerRow
              kind="best"
              seller={best ? { name: best.name, detail: unitsSold(best.unitsSold) } : null}
              empty={`No sales in the last ${days} days`}
            />
            <SellerRow kind="worst" seller={worstSeller(data)} empty="Nothing to flag" />
            {count !== undefined && (
              <p className="home-sellers__count">
                {count} {count === 1 ? 'product' : 'products'} in inventory
              </p>
            )}
          </div>
        );
      })}
    </PreviewFrame>
  );
}

const X_AXIS_TITLES: Record<AnalyticsSummary['granularity'], string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
};

/**
 * Analytics: the Revenue Overview chart for the last `days` days (whatever "Show" is set to), one
 * line per category, with axis titles and the legend down the right-hand side.
 */
export function AnalyticsPreview({
  summary,
  days,
}: {
  summary: PreviewState<AnalyticsSummary>;
  days: number;
}) {
  const currency = useCurrency();
  return (
    <PreviewFrame>
      {renderState(summary, (data) =>
        data.revenueSeries.length === 0 ? (
          <PreviewMessage>No sales in the last {days} days</PreviewMessage>
        ) : (
          <div className="home-chart">
            <span className="home-chart__y-title">Revenue ({currency})</span>
            <div className="home-chart__plot">
              <LineChart
                categories={data.bucketLabels}
                series={data.revenueSeries}
                ariaLabel={`Revenue overview, last ${days} days`}
                width={460}
                height={240}
                formatValue={(cents) => formatCentsCompact(cents, currency)}
                formatTooltip={(cents) => formatCents(cents, currency)}
              />
              <span className="home-chart__x-title">{X_AXIS_TITLES[data.granularity]}</span>
            </div>
            <div className="home-chart__legend">
              <span className="home-chart__legend-title">Category</span>
              <ChartLegend labels={data.revenueSeries.map((s) => s.label)} />
            </div>
          </div>
        ),
      )}
    </PreviewFrame>
  );
}
