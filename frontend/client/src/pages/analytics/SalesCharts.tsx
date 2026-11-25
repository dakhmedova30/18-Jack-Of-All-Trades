import { useCurrency } from '../../hooks/useCurrency';
import type { SalesTrends } from '../../types';
import { formatCents, formatCentsCompact } from '../../utils/money';
import { ChartCard, FitWidth, indexOfMax, monthName, percentOf, sum } from './ChartCard';
import { ChartTable, ColumnChart, HorizontalBarChart, LineChart } from './charts';

const DAY_NAMES: Record<string, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday',
};

const PERIOD = 'Last 12 months';

function salesCount(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? 'sale' : 'sales'}`;
}

/** Sales Analytics' charts: revenue, sale count and average sale by month, busiest days, channels. */
export function SalesCharts({ data }: { data: SalesTrends }) {
  const currency = useCurrency();
  const money = (cents: number) => formatCents(cents, currency);
  const compact = (cents: number) => formatCentsCompact(cents, currency);
  const months = data.buckets.map(monthName);
  const totalSales = sum(data.saleCounts);

  if (totalSales === 0) {
    return (
      <ChartCard title="Sales trends" context={PERIOD} wide>
        <p className="empty-state">
          No sales in the last 12 months. Once you record sales, their trends show up here.
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
  const latest = data.buckets.length - 1;
  const bestAverage = indexOfMax(averages);
  const dayRevenue = data.byWeekday.map((day) => day.revenueCents);
  const busiest = data.byWeekday[indexOfMax(dayRevenue)]!;
  const channelTotal = sum(data.byChannel.map((channel) => channel.valueCents));
  const topChannel = data.byChannel[0];

  return (
    <>
      <ChartCard
        title="Revenue by month"
        context={PERIOD}
        wide
        insight={
          best === latest
            ? `${months[latest]} is your best month yet, with ${money(data.revenueCents[latest]!)} so far.`
            : `Your best month was ${months[best]}, with ${money(data.revenueCents[best]!)}. ${months[latest]} so far: ${money(data.revenueCents[latest]!)}.`
        }
      >
        <FitWidth fallback={840}>
          {(width) => (
            <LineChart
              categories={data.bucketLabels}
              series={[{ label: 'Revenue', values: data.revenueCents }]}
              ariaLabel="Revenue by month"
              width={width}
              height={240}
              formatValue={compact}
              formatTooltip={money}
            />
          )}
        </FitWidth>
        <ChartTable
          columns={['Month', 'Revenue']}
          rows={months.map((month, i) => [month, money(data.revenueCents[i]!)])}
        />
      </ChartCard>

      <ChartCard
        title="Sales by month"
        context={PERIOD}
        insight={`${salesCount(totalSales)} in the last 12 months, about ${Math.round(totalSales / months.length).toLocaleString()} a month.`}
      >
        <FitWidth fallback={420}>
          {(width) => (
            <ColumnChart
              categories={data.bucketLabels}
              series={[{ label: 'Sales', values: data.saleCounts }]}
              ariaLabel="Number of sales by month"
              width={width}
              formatValue={(count) => count.toLocaleString()}
              describe={(i) => `${months[i]}: ${salesCount(data.saleCounts[i]!)}`}
              wholeNumbers
            />
          )}
        </FitWidth>
        <ChartTable
          columns={['Month', 'Sales']}
          rows={months.map((month, i) => [month, data.saleCounts[i]!.toLocaleString()])}
        />
      </ChartCard>

      <ChartCard
        title="Average sale by month"
        context={PERIOD}
        insight={`A sale averages ${money(Math.round(totalRevenue / totalSales))} over the last 12 months; the highest month was ${months[bestAverage]}, at ${money(averages[bestAverage]!)}.`}
      >
        <FitWidth fallback={420}>
          {(width) => (
            <ColumnChart
              categories={data.bucketLabels}
              series={[{ label: 'Average sale', values: averages }]}
              ariaLabel="Average sale by month"
              width={width}
              formatValue={compact}
              describe={(i) =>
                data.saleCounts[i]
                  ? `${months[i]}: ${money(averages[i]!)} on average over ${salesCount(data.saleCounts[i]!)}`
                  : `${months[i]}: no sales`
              }
            />
          )}
        </FitWidth>
        <ChartTable
          columns={['Month', 'Average sale']}
          rows={months.map((month, i) => [month, data.saleCounts[i] ? money(averages[i]!) : '—'])}
        />
      </ChartCard>

      <ChartCard
        title="Busiest days"
        context={PERIOD}
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

      <ChartCard
        title="Revenue by channel"
        context={PERIOD}
        insight={
          topChannel && channelTotal > 0
            ? `"${topChannel.label}" brings in ${percentOf(topChannel.valueCents, channelTotal)}% of your revenue.`
            : 'No revenue to split by channel yet.'
        }
      >
        {data.byChannel.length === 0 ? (
          <p className="empty-state">No revenue in the last 12 months.</p>
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
    </>
  );
}
