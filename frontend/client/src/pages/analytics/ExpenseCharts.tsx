import { useCurrency } from '../../hooks/useCurrency';
import type { DateRange, ExpenseTrends } from '../../types';
import { formatCents, formatCentsCompact } from '../../utils/money';
import { periodPhrase } from './analyticsPeriod';
import {
  BUCKET_HEADING,
  bucketCount,
  bucketDate,
  bucketPhrase,
  ChartCard,
  FitWidth,
  indexOfMax,
  orList,
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
/** Slots 3 and 4 for restocks and running costs, named in their own legend. */
const COST_COLORS = [SERIES_COLORS[2], SERIES_COLORS[3]];

const AXIS_LABEL = { day: 'Day', week: 'Week', month: 'Month' } as const;

interface ExpenseChartsProps {
  data: ExpenseTrends;
  /** The period `data` covers, for the sentences under the charts. */
  period: DateRange;
  /** The first tags `data`'s expenses are narrowed to, or null for every expense. */
  tags: string[] | null;
}

/**
 * Expense Analytics' charts: spending by tag, profit, and restock vs running costs over time (by
 * day, week or month, as the server split the period), and spending by tag over the whole period.
 * For chosen tags, no profit (their spending against every sale isn't one), and for a single tag
 * no comparison of tags either.
 */
export function ExpenseCharts({ data, period, tags }: ExpenseChartsProps) {
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

  if (tags !== null && totalExpenses === 0) {
    return (
      <ChartCard title="Expense trends" wide>
        <p className="empty-state">
          No {orList(tags.map((tag) => `\u201c${tag}\u201d`))} expenses {phrase}. Choose a longer
          date range or other tags, or record an expense to see it here.
        </p>
      </ChartCard>
    );
  }

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
  const peak = indexOfMax(expenses);
  const tagTotal = sum(data.byTag.map((total) => total.valueCents));
  const lines = data.expenseSeries.map((series) => series.label);
  const onlyTag = tags?.length === 1 ? tags[0]! : null;
  const topTag = data.byTag[0];

  return (
    <>
      <ChartCard
        title={`Expenses by ${unit}`}
        wide
        insight={
          totalExpenses === 0
            ? undefined
            : data.buckets.length > 1
              ? `Your highest-spending ${unit} ${phrase} was ${bucketPhrase(data.buckets[peak]!, unit)}, at ${money(expenses[peak]!)}.`
              : `${money(totalExpenses)} spent ${phrase}.`
        }
      >
        {data.expenseSeries.length === 0 ? (
          <p className="empty-state">No expenses {phrase}.</p>
        ) : (
          <>
            <FitWidth fallback={840}>
              {(width) => (
                <LineChart
                  categories={data.bucketLabels}
                  series={data.expenseSeries}
                  ariaLabel={`Expenses by tag, by ${unit}`}
                  width={width}
                  height={240}
                  formatValue={compact}
                  formatTooltip={money}
                />
              )}
            </FitWidth>
            <div className="analytics-card__footer">
              <span className="muted">
                {tags === null
                  ? 'One line per tag'
                  : onlyTag
                    ? `"${onlyTag}" only`
                    : 'One line per chosen tag'}
              </span>
              <ChartLegend labels={lines} />
            </div>
            {/* With one line, a Total column would only repeat it. */}
            <ChartTable
              columns={[BUCKET_HEADING[unit], ...lines, ...(lines.length > 1 ? ['Total'] : [])]}
              rows={dates.map((date, i) => [
                date,
                ...data.expenseSeries.map((series) => money(series.values[i] ?? 0)),
                ...(lines.length > 1 ? [money(expenses[i]!)] : []),
              ])}
            />
          </>
        )}
      </ChartCard>

      {/* Some tags' spending against every sale isn't a profit, so it waits for "All tags". */}
      {tags === null && (
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
      )}

      {/* For chosen tags, this fills the row that profit would share. */}
      <ChartCard
        title="Restocks and running costs"
        wide={tags !== null}
        insight={
          totalExpenses === 0
            ? `No expenses ${phrase}.`
            : tags
              ? `Restocking is ${restockShare}% of ${onlyTag ? `"${onlyTag}"` : "the chosen tags'"} spending; running costs are the other ${100 - restockShare}%.`
              : `Restocking is ${restockShare}% of your spending; running costs such as rent are the other ${100 - restockShare}%.`
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

      {/* One tag would be a single bar at 100%, so the comparison waits for "All tags". */}
      {onlyTag === null && (
        <ChartCard
          title="Spending by tag"
          wide
          insight={
            topTag && tagTotal > 0
              ? tags
                ? `"${topTag.label}" is the biggest of the chosen tags: ${percentOf(topTag.valueCents, tagTotal)}% of their spending.`
                : `"${topTag.label}" is your biggest cost: ${percentOf(topTag.valueCents, tagTotal)}% of spending.`
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
                    bars={data.byTag.map((total) => ({
                      label: total.label,
                      value: total.valueCents,
                      detail: `${percentOf(total.valueCents, tagTotal)}% of spending`,
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
                rows={data.byTag.map((total) => [
                  total.label,
                  money(total.valueCents),
                  `${percentOf(total.valueCents, tagTotal)}%`,
                ])}
              />
            </>
          )}
        </ChartCard>
      )}
    </>
  );
}
