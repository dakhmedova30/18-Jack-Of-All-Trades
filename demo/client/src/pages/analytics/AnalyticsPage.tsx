import { ChartLegend, DonutChart, LineChart, StackedBarChart, type ChartSeries } from './charts';

/**
 * Static visual demo (by design, see the project's Sales-vs-Analytics discussion):
 * the app has no concept of "expenses" or revenue "sources" yet, only items and
 * sales, so every number on this page is mock data, not a live query. Swap in
 * real figures once expense tracking and reporting exist.
 */

const REVENUE_CATEGORIES = ['January', 'February', 'March', 'April', 'May'];
const REVENUE_SERIES: ChartSeries[] = [
  { label: 'Source 1', values: [1200, 2600, 900, 2100, 1700] },
  { label: 'Source 2', values: [1800, 1300, 2000, 2300, 1400] },
  { label: 'Source 3', values: [700, 1900, 2200, 2000, 2800] },
];

const EXPENSE_CATEGORIES = ['M', 'T', 'W', 'Th', 'F', 'S', 'Su'];
const EXPENSE_SERIES: ChartSeries[] = [
  { label: 'Source 1', values: [320, 180, 300, 420, 0, 0, 0] },
  { label: 'Source 2', values: [150, 90, 160, 260, 0, 0, 0] },
  { label: 'Source 3', values: [210, 140, 230, 380, 0, 0, 0] },
];

const SALES_SEGMENTS = [
  { label: 'Source 1', value: 32 },
  { label: 'Source 2', value: 27 },
  { label: 'Source 3', value: 23 },
  { label: 'Source 4', value: 18 },
];

const INVENTORY_OVERVIEW = [
  { name: 'Lavender soy candle', stock: 40, expenses: '$720.00' },
  { name: 'Oatmeal goat milk soap', stock: 80, expenses: '$560.00' },
  { name: 'Ceramic planter (large)', stock: 6, expenses: '$288.00' },
  { name: 'Hand-dyed silk scarf', stock: 10, expenses: '$550.00' },
  { name: 'Botanical art print A3', stock: 25, expenses: '$875.00' },
];

export function AnalyticsPage() {
  return (
    <section className="page">
      <h1>Analytics</h1>
      <p className="muted">
        A visual preview with placeholder numbers — not wired to live data yet.
      </p>

      <div className="analytics-top">
        <div className="card analytics-card">
          <div className="analytics-card__header">
            <h2>Revenue Overview</h2>
            <label className="analytics-select">
              Show by
              <select defaultValue="month" disabled aria-label="Show revenue by (demo only)">
                <option value="month">Month</option>
              </select>
            </label>
          </div>
          <LineChart
            categories={REVENUE_CATEGORIES}
            series={REVENUE_SERIES}
            ariaLabel="Revenue overview by month"
          />
          <div className="analytics-card__footer">
            <span className="muted">Month</span>
            <ChartLegend labels={REVENUE_SERIES.map((s) => s.label)} />
          </div>
        </div>

        <div className="analytics-stats">
          <StatCard label="Net Profit" value="$13,584.00" delta="5% Increase" tone="positive" />
          <StatCard label="Total Revenue" value="$25,821.00" delta="5% Increase" tone="neutral" />
          <StatCard label="Total Expenses" value="$12,237.00" tone="neutral" />
        </div>
      </div>

      <div className="analytics-bottom">
        <div className="card analytics-card">
          <h2>Expenses Overview</h2>
          <StackedBarChart
            categories={EXPENSE_CATEGORIES}
            series={EXPENSE_SERIES}
            ariaLabel="Expenses overview by weekday"
          />
          <ChartLegend labels={EXPENSE_SERIES.map((s) => s.label)} />
          <p className="analytics-insight">Thursday has the highest spend this week.</p>
        </div>

        <div className="card analytics-card">
          <h2>Sales Overview</h2>
          <div className="analytics-donut">
            <DonutChart segments={SALES_SEGMENTS} ariaLabel="Sales overview by source" />
            <ChartLegend labels={SALES_SEGMENTS.map((s) => s.label)} />
          </div>
          <p className="analytics-insight">Source 1 leads at 32% of total sales.</p>
        </div>

        <div className="card analytics-card">
          <h2>Inventory Overview</h2>
          <ul className="analytics-inventory">
            {INVENTORY_OVERVIEW.map((item) => (
              <li key={item.name}>
                <span className="analytics-inventory__swatch" aria-hidden="true" />
                <span className="analytics-inventory__name">{item.name}</span>
                <span className="analytics-inventory__stat">
                  <span className="muted">Stock</span>
                  {item.stock}
                </span>
                <span className="analytics-inventory__stat">
                  <span className="muted">Expenses</span>
                  {item.expenses}
                </span>
              </li>
            ))}
          </ul>
          <p className="analytics-insight">Ceramic planters are running low on stock.</p>
        </div>
      </div>
    </section>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  delta?: string;
  tone: 'positive' | 'neutral';
}

function StatCard({ label, value, delta, tone }: StatCardProps) {
  return (
    <div className={`stat-card stat-card--${tone}`}>
      <span className="stat-card__label">{label}</span>
      <span className="stat-card__value">{value}</span>
      {delta && <span className="stat-card__delta">↗ {delta}</span>}
    </div>
  );
}
