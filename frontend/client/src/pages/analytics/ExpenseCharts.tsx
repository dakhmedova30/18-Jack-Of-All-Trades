import { useCurrency } from '../../hooks/useCurrency';
import type { DateRange, ExpenseTrends } from '../../types';
import { formatCents, formatCentsCompact } from '../../utils/money';
import { periodPhrase } from './analyticsPeriod';
import {
  BUCKET_HEADING,
  bucketCount,
  bucketDate,
  ChartCard,
  FitWidth,
  percentOf,
  sum,
} from './ChartCard';
import {
  ChartLegend,
  ChartTable,
  ColumnChart,
  HorizontalBarChart,
  LineChart,
  LOSS_COLOR,
  SERIES_COLORS,
} from './charts';

const PROFIT_COLORS = [SERIES_COLORS[0], LOSS_COLOR];
/** Slots 3 and 4, so restocks and running costs don't take the revenue and expense colors above them. */
const COST_COLORS = [SERIES_COLORS[2], SERIES_COLORS[3]];

const AXIS_LABEL = { day: 'Day', week: 'Week', month: 'Month' } as const;

interface ExpenseChartsProps {
  data: ExpenseTrends;
  /** The period `data` covers, for the sentences under the charts. */
  period: DateRange;
}

/**
 * Expense Analytics' charts: revenue against expenses, profit, restock vs running costs over time
 * (by day, week or month, as the server split the period), and spending by tag.
 */
export function ExpenseCharts({ data, period }: ExpenseChartsProps) {
  const currency = useCurrency();
  const money = (cents: number) => formatCents(cents, currency);
  const compact = (cents: number) => formatCentsCompact(cents, currency);
  const unit = data.granularity;
  const dates = data.buckets.map((key) => bucketDate(key, unit));
  const phrase = periodPhrase(period);
  const expenses = data.restockCents.map((cents, i) => cents + data.runningCents[i]!);
  const profit = data.revenueCents.map((cents, i) => cents - expenses[i]!);
  const totalRevenue = sum(data.revenueCents);
  const totalExpenses = sum(expenses);

  if (totalRevenue === 0 && totalExpenses === 0) {
    return (
      <ChartCard title="Costs and profit" wide>
        <p className="empty-state">
          No sales or expenses {phrase}. Choose a longer date range, or record some to see your
          costs and profit here.
        </p>
      </ChartCard>
    );
  }

  const totalProfit = totalRevenue - totalExpenses;
  const profitBuckets = profit.filter((cents) => cents > 0).length;
  const lossBuckets = profit.filter((cents) => cents < 0).length;
  const restockShare = percentOf(sum(data.restockCents), totalExpenses);
  const tagTotal = sum(data.byTag.map((tag) => tag.valueCents));
  const topTag = data.byTag[0];

  return (
    <>
      <ChartCard
        title="Revenue and expenses"
        wide
        insight={
          totalRevenue > 0
            ? `Expenses came to ${percentOf(totalExpenses, totalRevenue)}% of revenue ${phrase}.`
            : `No revenue ${phrase} to set against ${money(totalExpenses)} of expenses.`
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
              ariaLabel={`Revenue and expenses by ${unit}`}
              width={width}
              height={240}
              formatValue={compact}
              formatTooltip={money}
            />
          )}
        </FitWidth>
        <div className="analytics-card__footer">
          <span className="muted">{AXIS_LABEL[unit]}</span>
          <ChartLegend labels={['Revenue', 'Expenses']} />
        </div>
        <ChartTable
          columns={[BUCKET_HEADING[unit], 'Revenue', 'Expenses']}
          rows={dates.map((date, i) => [date, money(data.revenueCents[i]!), money(expenses[i]!)])}
        />
      </ChartCard>

      <ChartCard
        title={`Profit by ${unit}`}
        insight={`A profit in ${bucketCount(profitBuckets, unit)} and a loss in ${bucketCount(lossBuckets, unit)}: ${money(Math.abs(totalProfit))} ${totalProfit < 0 ? 'lost' : 'made'} overall.`}
      >
        <FitWidth fallback={420}>
          {(width) => (
            <ColumnChart
              categories={data.bucketLabels}
              series={[{ label: 'Profit', values: profit }]}
              ariaLabel={`Profit by ${unit}`}
              width={width}
              formatValue={compact}
              colorForValue={(cents) => (cents < 0 ? LOSS_COLOR : SERIES_COLORS[0])}
              describe={(i) =>
                `${dates[i]}: ${profit[i]! < 0 ? 'loss' : 'profit'} of ${money(Math.abs(profit[i]!))}`
              }
            />
          )}
        </FitWidth>
        <div className="analytics-card__footer">
          <span className="muted">Revenue minus expenses</span>
          <ChartLegend labels={['Profit', 'Loss']} colors={PROFIT_COLORS} />
        </div>
        <ChartTable
          columns={[BUCKET_HEADING[unit], 'Profit']}
          rows={dates.map((date, i) => [date, money(profit[i]!)])}
        />
      </ChartCard>

      <ChartCard
        title="Restocks and running costs"
        insight={
          totalExpenses > 0
            ? `Restocking is ${restockShare}% of your spending; running costs such as rent are the other ${100 - restockShare}%.`
            : `No expenses ${phrase}.`
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
              ariaLabel={`Restocks and running costs by ${unit}`}
              width={width}
              formatValue={compact}
              describe={(i) =>
                `${dates[i]}: restocks ${money(data.restockCents[i]!)}, running costs ${money(data.runningCents[i]!)}`
              }
            />
          )}
        </FitWidth>
        <div className="analytics-card__footer">
          <span className="muted">{AXIS_LABEL[unit]}</span>
          <ChartLegend labels={['Restocks', 'Running costs']} colors={COST_COLORS} />
        </div>
        <ChartTable
          columns={[BUCKET_HEADING[unit], 'Restocks', 'Running costs', 'Total']}
          rows={dates.map((date, i) => [
            date,
            money(data.restockCents[i]!),
            money(data.runningCents[i]!),
            money(expenses[i]!),
          ])}
        />
      </ChartCard>

      <ChartCard
        title="Spending by tag"
        wide
        insight={
          topTag && tagTotal > 0
            ? `"${topTag.label}" is your biggest cost: ${percentOf(topTag.valueCents, tagTotal)}% of spending.`
            : undefined
        }
      >
        {data.byTag.length === 0 ? (
          <p className="empty-state">No expenses {phrase}.</p>
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
