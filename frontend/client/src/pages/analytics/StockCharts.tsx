import { useCurrency } from '../../hooks/useCurrency';
import type { StockHealth } from '../../types';
import { formatCents, formatCentsCompact } from '../../utils/money';
import { ChartCard, FitWidth, percentOf, sum } from './ChartCard';
import { ChartTable, HorizontalBarChart, SegmentedBar, STATUS_COLORS } from './charts';

/** 0 -> "Out of stock", 0.4 -> "Under a day", 1 -> "1 day", 12.6 -> "13 days". */
export function formatDaysLeft(days: number): string {
  if (days === 0) return 'Out of stock';
  if (days < 1) return 'Under a day';
  const whole = Math.round(days);
  return `${whole.toLocaleString()} ${whole === 1 ? 'day' : 'days'}`;
}

function productCount(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? 'product' : 'products'}`;
}

/** Inventory Analytics' charts: stock levels, stock value by tag, and what will run out first. */
export function StockCharts({ data }: { data: StockHealth }) {
  const currency = useCurrency();
  const money = (cents: number) => formatCents(cents, currency);
  const compact = (cents: number) => formatCentsCompact(cents, currency);
  const products = data.outOfStockCount + data.lowStockCount + data.wellStockedCount;

  if (products === 0) {
    return (
      <ChartCard title="Stock levels" wide>
        <p className="empty-state">
          No products in inventory yet. Add some and their stock levels show up here.
        </p>
      </ChartCard>
    );
  }

  const needRestock = data.outOfStockCount + data.lowStockCount;
  const restockParts = [
    data.outOfStockCount > 0 && `${data.outOfStockCount.toLocaleString()} out of stock`,
    data.lowStockCount > 0 && `${data.lowStockCount.toLocaleString()} running low`,
  ].filter(Boolean);
  const totalValue = sum(data.valueByTag.map((tag) => tag.valueCents));
  const topTag = data.valueByTag[0];
  const first = data.runningOut[0];
  const pace = `the last ${data.paceDays} days`;

  return (
    <>
      <ChartCard
        title="Stock levels"
        context={productCount(products)}
        wide
        insight={
          needRestock === 0
            ? 'Everything is well stocked.'
            : `${needRestock.toLocaleString()} of your ${productCount(products)} ${needRestock === 1 ? 'needs' : 'need'} restocking: ${restockParts.join(' and ')}.`
        }
      >
        <SegmentedBar
          ariaLabel={`Stock levels: ${data.outOfStockCount} out of stock, ${data.lowStockCount} low, ${data.wellStockedCount} well stocked`}
          segments={[
            { label: 'Out of stock', count: data.outOfStockCount, color: STATUS_COLORS.critical },
            {
              label: `Low (${data.lowStockThreshold} or fewer)`,
              count: data.lowStockCount,
              color: STATUS_COLORS.warning,
            },
            { label: 'Well stocked', count: data.wellStockedCount, color: STATUS_COLORS.good },
          ]}
        />
      </ChartCard>

      <ChartCard
        title="Stock value by tag"
        context="At selling price"
        insight={
          topTag && totalValue > 0
            ? `"${topTag.label}" holds ${percentOf(topTag.valueCents, totalValue)}% of your stock value (${money(topTag.valueCents)}).`
            : 'Nothing in stock has a value yet.'
        }
      >
        <FitWidth fallback={420}>
          {(width) => (
            <HorizontalBarChart
              bars={data.valueByTag.map((tag) => ({
                label: tag.label,
                value: tag.valueCents,
                detail: `${productCount(tag.itemCount)}, ${tag.quantity.toLocaleString()} units`,
              }))}
              width={width}
              ariaLabel="Stock value by tag"
              formatValue={compact}
              formatTooltip={money}
            />
          )}
        </FitWidth>
        <ChartTable
          columns={['Tag', 'Value', 'Units', 'Products']}
          rows={data.valueByTag.map((tag) => [
            tag.label,
            money(tag.valueCents),
            tag.quantity.toLocaleString(),
            tag.itemCount.toLocaleString(),
          ])}
        />
      </ChartCard>

      <ChartCard
        title="Days of stock left"
        context={`At ${pace}' pace`}
        insight={
          !first
            ? `Nothing sold in ${pace}, so there's no pace to go by.`
            : first.daysLeft === 0
              ? `"${first.name}" is out of stock but sold ${first.unitsSold.toLocaleString()} in ${pace}: restock it first.`
              : `At this pace, "${first.name}" runs out first, ${first.daysLeft < 1 ? 'in under a day' : `in about ${formatDaysLeft(first.daysLeft)}`}.`
        }
      >
        {data.runningOut.length === 0 ? (
          <p className="empty-state">No sales in {pace}.</p>
        ) : (
          <>
            <FitWidth fallback={420}>
              {(width) => (
                <HorizontalBarChart
                  bars={data.runningOut.map((item) => ({
                    id: item.id,
                    label: item.name,
                    value: item.daysLeft,
                    detail: `${item.quantity.toLocaleString()} left, ${item.unitsSold.toLocaleString()} sold in ${pace}`,
                  }))}
                  width={width}
                  ariaLabel="Days of stock left at the recent selling pace"
                  formatValue={formatDaysLeft}
                  formatTooltip={formatDaysLeft}
                />
              )}
            </FitWidth>
            <ChartTable
              columns={['Item', 'In stock', `Sold, last ${data.paceDays} days`, 'Days left']}
              rows={data.runningOut.map((item) => [
                item.name,
                item.quantity.toLocaleString(),
                item.unitsSold.toLocaleString(),
                formatDaysLeft(item.daysLeft),
              ])}
            />
          </>
        )}
      </ChartCard>
    </>
  );
}
