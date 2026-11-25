package ca.jackofalltrades.analytics;

import ca.jackofalltrades.analytics.AnalyticsSummary.TagTotal;
import java.util.List;

/**
 * The {@code GET /api/analytics/sales-trends} JSON, for Sales Analytics: every sale in the last
 * 12 calendar months (UTC), this one included. {@code revenueCents} and {@code saleCounts} line up
 * with {@code buckets} ("YYYY-MM"); {@code byWeekday} runs Monday to Sunday; {@code byChannel}
 * lists every channel with revenue, largest first. Money is in the account's currency.
 */
public record SalesTrends(
        List<String> buckets,
        List<String> bucketLabels,
        List<Long> revenueCents,
        List<Long> saleCounts,
        List<WeekdayTotal> byWeekday,
        List<TagTotal> byChannel) {

    /** @param day "Mon" to "Sun" */
    public record WeekdayTotal(String day, long saleCount, long revenueCents) {}
}
