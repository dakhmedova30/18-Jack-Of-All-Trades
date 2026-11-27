import { useCallback, useState } from 'react';
import { getSalesTrends } from '../../api/analytics';
import { useAnalyticsDateRange } from '../../hooks/useAnalyticsDateRange';
import { useApiData } from '../../hooks/useApiData';
import { useChannels } from '../../hooks/useChannels';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useInventoryInsights } from '../../hooks/useInventoryInsights';
import { useSalesMonthSummary } from '../../hooks/useSalesMonthSummary';
import type { DateRange } from '../../types';
import { BestSellersPanel } from '../sales/BestSellersPanel';
import { MonthGlancePanel } from '../sales/MonthGlancePanel';
import { ChartFilters, RELOAD_DELAY_MS, useChartPeriod } from './analyticsPeriod';
import { AnalyticsSubpage } from './AnalyticsSubpage';
import { ChartSection, PeriodChartsSection } from './ChartCard';
import { SalesCharts } from './SalesCharts';

/**
 * /analytics/sales: the filters (the main Analytics page's dates, and sales channels) beside this
 * month's sales count, average and largest sale, and best sellers; then charts of revenue by
 * channel, sales, average sale, busiest days and channels for the chosen period and channels.
 */
export function SalesAnalyticsPage() {
  const monthSummary = useSalesMonthSummary();
  const insights = useInventoryInsights();
  const dates = useAnalyticsDateRange();
  const period = useChartPeriod(dates.data);
  // The ticked channels' ids, as the checkboxes give them.
  const [ticked, setTicked] = useState<string[]>([]);
  const channels = useChannels();
  const options = channels.data?.map((channel) => ({
    value: String(channel.id),
    label: channel.name,
  }));
  // Ticking none or every channel shows them all, so neither narrows the charts.
  const narrowed =
    options && ticked.length > 0 && ticked.length < options.length ? ticked.join(',') : '';
  // As with the dates, wait until the boxes stop changing before reloading.
  const channelKey = useDebouncedValue(narrowed, RELOAD_DELAY_MS);
  const channelNames = channelKey
    ? channelKey
        .split(',')
        .map(
          (id) =>
            channels.data?.find((channel) => String(channel.id) === id)?.name ??
            'a removed channel',
        )
    : null;

  return (
    <AnalyticsSubpage slug="sales">
      <div className="analytics-subpage__top">
        {/* Always there, so the cards keep their place while the filters load. */}
        <div className="analytics-subpage__filters">
          {dates.data && period && (
            <ChartFilters
              dates={dates.data}
              period={period}
              choice={{
                heading: 'Sales channels',
                label: 'Channels',
                allLabel: 'All channels',
                plural: 'channels',
                options,
                error: channels.error,
                value: ticked,
                onChange: setTicked,
                note: 'Narrows the charts below. Tick none or all to see every channel.',
              }}
            />
          )}
        </div>
        <div className="panel-row">
          <MonthGlancePanel {...monthSummary} />
          <BestSellersPanel {...insights} />
        </div>
      </div>
      <PeriodChartsSection dates={dates} period={period} label="sales trends">
        {(requested) => (
          <SalesTrendsCharts
            period={requested}
            channelKey={channelKey}
            channelNames={channelNames}
          />
        )}
      </PeriodChartsSection>
    </AnalyticsSubpage>
  );
}

interface SalesTrendsChartsProps {
  period: DateRange;
  /** The chosen channels' ids, comma-separated; '' for every channel. A string, so it's stable. */
  channelKey: string;
  /** The chosen channels' names, or null for every channel. */
  channelNames: string[] | null;
}

/**
 * The charts for one settled period and choice of channels; a new choice reloads them, keeping
 * the old ones dimmed.
 */
function SalesTrendsCharts({ period, channelKey, channelNames }: SalesTrendsChartsProps) {
  const load = useCallback(
    () => getSalesTrends(period, channelKey ? channelKey.split(',').map(Number) : undefined),
    [period, channelKey],
  );
  const trends = useApiData(load);
  return (
    <ChartSection resource={trends} label="sales trends">
      {(data) => <SalesCharts data={data} period={period} channelNames={channelNames} />}
    </ChartSection>
  );
}
