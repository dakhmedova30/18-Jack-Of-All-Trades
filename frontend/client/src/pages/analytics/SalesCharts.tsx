import { useCurrency } from '../../hooks/useCurrency';
import type { DateRange, SalesTrends } from '../../types';
import { formatCents, formatCentsCompact } from '../../utils/money';
import { periodPhrase } from './analyticsPeriod';
import {
  BUCKET_HEADING,
  bucketDate,
  bucketPhrase,
  ChartCard,
  FitWidth,
  indexOfMax,
  orList,
  percentOf,
  sum,
} from './ChartCard';
import { ChartLegend, ChartTable, ColumnChart, HorizontalBarChart, LineChart } from './charts';

const DAY_NAMES: Record<string, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday',
};

function salesCount(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? 'sale' : 'sales'}`;
}

interface SalesChartsProps {
  data: SalesTrends;
  /** The period `data` covers, for the sentences under the charts. */
  period: DateRange;
  /** The one channel `data` covers, or null for every channel. */
  channelNames: string[] | null;
}

/**
 * Sales Analytics' charts: revenue (a line per channel), sale count and average sale over time (by
 * day, week or month, as the server split the period), busiest days and, for every channel, the
 * channels compared.
 */
export function SalesCharts({ data, period, channelNames }: SalesChartsProps) {
  const currency = useCurrency();
  const money = (cents: number) => formatCents(cents, currency);
  const compact = (cents: number) => formatCentsCompact(cents, currency);
  const unit = data.granularity;
  const dates = data.buckets.map((key) => bucketDate(key, unit));
  const named = (i: number) => bucketPhrase(data.buckets[i]!, unit);
  const phrase = periodPhrase(period);
  const several = data.buckets.length > 1;
  const totalSales = sum(data.saleCounts);

  if (totalSales === 0) {
    return (
      <ChartCard title="Sales trends" wide>
        <p className="empty-state">
          {channelNames
            ? `No ${orList(channelNames)} sales ${phrase}. Choose a longer date range or other channels, or record a sale to see its trends here.`
            : `No sales ${phrase}. Choose a longer date range, or record a sale to see its trends here.`}
        </p>
      </ChartCard>
    );
  }

  const totalRevenue = sum(data.revenueCents);
  const averages = data.revenueCents.map((cents, i) => {
    const count = data.saleCounts[i]!;
    return count > 0 ? Math.round(cents / count) : 0;
  });
  const best = indexOfMax(data.revenueCents);
  const bestAverage = indexOfMax(averages);
  const dayRevenue = data.byWeekday.map((day) => day.revenueCents);
  const busiest = data.byWeekday[indexOfMax(dayRevenue)]!;
  const channelTotal = sum(data.byChannel.map((channel) => channel.valueCents));
  const topChannel = data.byChannel[0];
  const lines = data.channelSeries.map((series) => series.label);
  const onlyChannel = channelNames?.length === 1 ? channelNames[0]! : null;
  // Fewer than one a month (say) rounds to "about 0", so that part is left out.
  const perBucket = Math.round(totalSales / data.buckets.length);

  return (
    <>
      <ChartCard
        title={`Revenue by ${unit}`}
        wide
        insight={
          totalRevenue === 0
            ? undefined
            : several
              ? `Your best ${unit} ${phrase} was ${named(best)}, with ${money(data.revenueCents[best]!)}.`
              : `${money(totalRevenue)} in revenue ${phrase}.`
        }
      >
        {lines.length === 0 ? (
          <p className="empty-state">No revenue {phrase}.</p>
        ) : (
          <>
            <FitWidth fallback={840}>
              {(width) => (
                <LineChart
                  categories={data.bucketLabels}
                  series={data.channelSeries}
                  ariaLabel={`Revenue by channel, by ${unit}`}
                  width={width}
                  height={240}
                  formatValue={compact}
                  formatTooltip={money}
                />
              )}
            </FitWidth>
            <div className="analytics-card__footer">
              <span className="muted">
                {channelNames === null
                  ? 'One line per channel'
                  : onlyChannel
                    ? `${onlyChannel} only`
                    : 'One line per chosen channel'}
              </span>
              <ChartLegend labels={lines} />
            </div>
            {/* With one line, a Total column would only repeat it. */}
            <ChartTable
              columns={[BUCKET_HEADING[unit], ...lines, ...(lines.length > 1 ? ['Total'] : [])]}
              rows={dates.map((date, i) => [
                date,
                ...data.channelSeries.map((series) => money(series.values[i] ?? 0)),
                ...(lines.length > 1 ? [money(data.revenueCents[i]!)] : []),
              ])}
            />
          </>
        )}
      </ChartCard>

      <ChartCard
        title={`Sales by ${unit}`}
        insight={`${salesCount(totalSales)} ${phrase}${several && perBucket > 0 ? `, about ${perBucket.toLocaleString()} a ${unit}` : ''}.`}
      >
        <FitWidth fallback={420}>
          {(width) => (
            <ColumnChart
              categories={data.bucketLabels}
              series={[{ label: 'Sales', values: data.saleCounts }]}
              ariaLabel={`Number of sales by ${unit}`}
              width={width}
              formatValue={(count) => count.toLocaleString()}
              describe={(i) => `${dates[i]}: ${salesCount(data.saleCounts[i]!)}`}
              wholeNumbers
            />
          )}
        </FitWidth>
        <ChartTable
          columns={[BUCKET_HEADING[unit], 'Sales']}
          rows={dates.map((date, i) => [date, data.saleCounts[i]!.toLocaleString()])}
        />
      </ChartCard>

      <ChartCard
        title={`Average sale by ${unit}`}
        insight={`A sale averages ${money(Math.round(totalRevenue / totalSales))} ${phrase}${several ? `; the highest ${unit} was ${named(bestAverage)}, at ${money(averages[bestAverage]!)}` : ''}.`}
      >
        <FitWidth fallback={420}>
          {(width) => (
            <ColumnChart
              categories={data.bucketLabels}
              series={[{ label: 'Average sale', values: averages }]}
              ariaLabel={`Average sale by ${unit}`}
              width={width}
              formatValue={compact}
              describe={(i) =>
                data.saleCounts[i]
                  ? `${dates[i]}: ${money(averages[i]!)} on average over ${salesCount(data.saleCounts[i]!)}`
                  : `${dates[i]}: no sales`
              }
            />
          )}
        </FitWidth>
        <ChartTable
          columns={[BUCKET_HEADING[unit], 'Average sale']}
          rows={dates.map((date, i) => [date, data.saleCounts[i] ? money(averages[i]!) : '—'])}
        />
      </ChartCard>

      {/* One channel's busiest days fill the row its comparison with the others would share. */}
      <ChartCard
        title="Busiest days"
        wide={onlyChannel !== null}
        insight={`${DAY_NAMES[busiest.day] ?? busiest.day}s bring in the most revenue: ${percentOf(busiest.revenueCents, sum(dayRevenue))}% of it.`}
      >
        <FitWidth fallback={420}>
          {(width) => (
            <ColumnChart
              categories={data.byWeekday.map((day) => day.day)}
              series={[{ label: 'Revenue', values: dayRevenue }]}
              ariaLabel="Revenue by day of the week"
              width={width}
              formatValue={compact}
              describe={(i) => {
                const day = data.byWeekday[i]!;
                return `${DAY_NAMES[day.day] ?? day.day}: ${money(day.revenueCents)} from ${salesCount(day.saleCount)}`;
              }}
            />
          )}
        </FitWidth>
        <ChartTable
          columns={['Day', 'Sales', 'Revenue']}
          rows={data.byWeekday.map((day) => [
            DAY_NAMES[day.day] ?? day.day,
            day.saleCount.toLocaleString(),
            money(day.revenueCents),
          ])}
        />
      </ChartCard>

      {/* One channel would be a single bar at 100%, so the comparison waits for "All channels". */}
      {onlyChannel === null && (
        <ChartCard
          title="Revenue by channel"
          insight={
            topChannel && channelTotal > 0
              ? `"${topChannel.label}" brings in ${percentOf(topChannel.valueCents, channelTotal)}% of ${channelNames ? "the chosen channels'" : 'your'} revenue.`
              : undefined
          }
        >
          {data.byChannel.length === 0 ? (
            <p className="empty-state">No revenue {phrase}.</p>
          ) : (
            <>
              <FitWidth fallback={420}>
                {(width) => (
                  <HorizontalBarChart
                    bars={data.byChannel.map((channel) => ({
                      label: channel.label,
                      value: channel.valueCents,
                      detail: `${percentOf(channel.valueCents, channelTotal)}% of revenue`,
                    }))}
                    width={width}
                    ariaLabel="Revenue by sales channel"
                    formatValue={compact}
                    formatTooltip={money}
                  />
                )}
              </FitWidth>
              <ChartTable
                columns={['Channel', 'Revenue', 'Share']}
                rows={data.byChannel.map((channel) => [
                  channel.label,
                  money(channel.valueCents),
                  `${percentOf(channel.valueCents, channelTotal)}%`,
                ])}
              />
            </>
          )}
        </ChartCard>
      )}
    </>
  );
}
