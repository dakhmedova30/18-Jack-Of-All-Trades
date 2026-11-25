import { useCurrency } from '../../hooks/useCurrency';
import type { ExpenseTrends } from '../../types';
import { formatCents, formatCentsCompact } from '../../utils/money';
import { ChartCard, FitWidth, monthName, percentOf, sum } from './ChartCard';
import {
  ChartLegend,
  ChartTable,
  ColumnChart,
  HorizontalBarChart,
  LineChart,
  LOSS_COLOR,
  SERIES_COLORS,
} from './charts';

const PERIOD = 'Last 12 months';
const PROFIT_COLORS = [SERIES_COLORS[0], LOSS_COLOR];
/** Slots 3 and 4, so restocks and running costs don't take the revenue and expense colors above them. */
const COST_COLORS = [SERIES_COLORS[2], SERIES_COLORS[3]];

function monthCount(count: number): string {
  return `${count} ${count === 1 ? 'month' : 'months'}`;
}

/** Expense Analytics' charts: revenue against expenses, profit, restock vs running costs, tags. */
export function ExpenseCharts({ data }: { data: ExpenseTrends }) {
  const currency = useCurrency();
  const money = (cents: number) => formatCents(cents, currency);
  const compact = (cents: number) => formatCentsCompact(cents, currency);
  const months = data.buckets.map(monthName);
  const expenses = data.restockCents.map((cents, i) => cents + data.runningCents[i]!);
  const profit = data.revenueCents.map((cents, i) => cents - expenses[i]!);
  const totalRevenue = sum(data.revenueCents);
  const totalExpenses = sum(expenses);

  if (totalRevenue === 0 && totalExpenses === 0) {
    return (
      <ChartCard title="Costs and profit" context={PERIOD} wide>
        <p className="empty-state">
          No sales or expenses in the last 12 months. Once you record some, your costs and profit
          show up here.
        </p>
      </ChartCard>
    );
  }

  const totalProfit = totalRevenue - totalExpenses;
  const profitMonths = profit.filter((cents) => cents > 0).length;
  const lossMonths = profit.filter((cents) => cents < 0).length;
  const restockShare = percentOf(sum(data.restockCents), totalExpenses);
  const tagTotal = sum(data.byTag.map((tag) => tag.valueCents));
  const topTag = data.byTag[0];

  return (
    <>
      <ChartCard
        title="Revenue and expenses"
        context={PERIOD}
        wide
        insight={
          totalRevenue > 0
            ? `Expenses came to ${percentOf(totalExpenses, totalRevenue)}% of revenue over the last 12 months.`
            : `No revenue in the last 12 months to set against ${money(totalExpenses)} of expenses.`
        }
      >
        <FitWidth fallback={840}>
          {(width) => (
            <LineChart
              categories={data.bucketLabels}
              series={[
                { label: 'Revenue', values: data.revenueCents },
                { label: 'Expenses', values: expenses },
              ]}
              ariaLabel="Revenue and expenses by month"
              width={width}
              height={240}
              formatValue={compact}
              formatTooltip={money}
            />
          )}
        </FitWidth>
        <div className="analytics-card__footer">
          <span className="muted">Month</span>
          <ChartLegend labels={['Revenue', 'Expenses']} />
        </div>
        <ChartTable
          columns={['Month', 'Revenue', 'Expenses']}
          rows={months.map((month, i) => [
            month,
            money(data.revenueCents[i]!),
            money(expenses[i]!),
          ])}
        />
      </ChartCard>

      <ChartCard
        title="Profit by month"
        context={PERIOD}
        insight={`A profit in ${monthCount(profitMonths)} and a loss in ${monthCount(lossMonths)}: ${money(Math.abs(totalProfit))} ${totalProfit < 0 ? 'lost' : 'made'} overall.`}
      >
        <FitWidth fallback={420}>
          {(width) => (
            <ColumnChart
              categories={data.bucketLabels}
              series={[{ label: 'Profit', values: profit }]}
              ariaLabel="Profit by month"
              width={width}
              formatValue={compact}
              colorForValue={(cents) => (cents < 0 ? LOSS_COLOR : SERIES_COLORS[0])}
              describe={(i) =>
                `${months[i]}: ${profit[i]! < 0 ? 'loss' : 'profit'} of ${money(Math.abs(profit[i]!))}`
              }
            />
          )}
        </FitWidth>
        <div className="analytics-card__footer">
          <span className="muted">Revenue minus expenses</span>
          <ChartLegend labels={['Profit', 'Loss']} colors={PROFIT_COLORS} />
        </div>
        <ChartTable
          columns={['Month', 'Profit']}
          rows={months.map((month, i) => [month, money(profit[i]!)])}
        />
      </ChartCard>

      <ChartCard
        title="Restocks and running costs"
        context={PERIOD}
        insight={
          totalExpenses > 0
            ? `Restocking is ${restockShare}% of your spending; running costs such as rent are the other ${100 - restockShare}%.`
            : 'No expenses in the last 12 months.'
        }
      >
        <FitWidth fallback={420}>
          {(width) => (
            <ColumnChart
              categories={data.bucketLabels}
              series={[
                { label: 'Restocks', values: data.restockCents },
                { label: 'Running costs', values: data.runningCents },
              ]}
              colors={COST_COLORS}
              ariaLabel="Restocks and running costs by month"
              width={width}
              formatValue={compact}
              describe={(i) =>
                `${months[i]}: restocks ${money(data.restockCents[i]!)}, running costs ${money(data.runningCents[i]!)}`
              }
            />
          )}
        </FitWidth>
        <div className="analytics-card__footer">
          <span className="muted">Month</span>
          <ChartLegend labels={['Restocks', 'Running costs']} colors={COST_COLORS} />
        </div>
        <ChartTable
          columns={['Month', 'Restocks', 'Running costs', 'Total']}
          rows={months.map((month, i) => [
            month,
            money(data.restockCents[i]!),
            money(data.runningCents[i]!),
            money(expenses[i]!),
          ])}
        />
      </ChartCard>

      <ChartCard
        title="Spending by tag"
        context={PERIOD}
        wide
        insight={
          topTag && tagTotal > 0
            ? `"${topTag.label}" is your biggest cost: ${percentOf(topTag.valueCents, tagTotal)}% of spending.`
            : 'No expenses in the last 12 months.'
        }
      >
        {data.byTag.length === 0 ? (
          <p className="empty-state">No expenses in the last 12 months.</p>
        ) : (
          <>
            <FitWidth fallback={840}>
              {(width) => (
                <HorizontalBarChart
                  bars={data.byTag.map((tag) => ({
                    label: tag.label,
                    value: tag.valueCents,
                    detail: `${percentOf(tag.valueCents, tagTotal)}% of spending`,
                  }))}
                  width={width}
                  ariaLabel="Spending by tag"
                  formatValue={compact}
                  formatTooltip={money}
                />
              )}
            </FitWidth>
            <ChartTable
              columns={['Tag', 'Spent', 'Share']}
              rows={data.byTag.map((tag) => [
                tag.label,
                money(tag.valueCents),
                `${percentOf(tag.valueCents, tagTotal)}%`,
              ])}
            />
          </>
        )}
      </ChartCard>
    </>
  );
}
