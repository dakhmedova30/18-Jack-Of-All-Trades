package ca.jackofalltrades.analytics;

import ca.jackofalltrades.analytics.AnalyticsSummary.TagSeries;
import ca.jackofalltrades.analytics.AnalyticsSummary.TagTotal;
import java.util.List;

/**
 * The {@code GET /api/analytics/sales-trends} JSON, for Sales Analytics: every sale in the chosen
 * period, or the last 12 calendar months (UTC), from every channel or the one asked for.
 * {@code granularity} is "day", "week" or "month", as for the summary; {@code revenueCents},
 * {@code saleCounts} and each of {@code channelSeries}' values line up with {@code buckets}
 * ("YYYY-MM", or "YYYY-MM-DD" for a day or a week's Monday); {@code channelSeries} has the top 3
 * channels by revenue, then "Other" (last) if there are more; {@code byWeekday} runs Monday to
 * Sunday; {@code byChannel} lists every channel with revenue, largest first. Money is in the
 * account's currency.
 */
public record SalesTrends(
        String granularity,
        List<String> buckets,
        List<String> bucketLabels,
        List<Long> revenueCents,
        List<TagSeries> channelSeries,
        List<Long> saleCounts,
        List<WeekdayTotal> byWeekday,
        List<TagTotal> byChannel) {

    /** @param day "Mon" to "Sun" */
    public record WeekdayTotal(String day, long saleCount, long revenueCents) {}
}
