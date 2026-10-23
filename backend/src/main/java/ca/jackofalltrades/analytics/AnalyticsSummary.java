package ca.jackofalltrades.analytics;

import java.util.List;

/**
 * The {@code GET /api/analytics/summary} JSON (contract §6). Totals cover every record from the
 * window's start onward, as the demo; each series' values line up with {@code buckets}.
 */
public record AnalyticsSummary(
        String range,
        String granularity,
        List<String> buckets,
        List<String> bucketLabels,
        long totalRevenueCents,
        long totalExpensesCents,
        long netProfitCents,
        List<TagSeries> revenueSeries,
        List<TagSeries> expenseSeries,
        List<TagTotal> salesByTag) {

    public record TagSeries(String label, List<Long> values) {}

    public record TagTotal(String label, long valueCents) {}
}
