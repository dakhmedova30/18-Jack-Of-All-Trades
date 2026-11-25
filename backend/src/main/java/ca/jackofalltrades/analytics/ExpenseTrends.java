package ca.jackofalltrades.analytics;

import ca.jackofalltrades.analytics.AnalyticsSummary.TagSeries;
import ca.jackofalltrades.analytics.AnalyticsSummary.TagTotal;
import java.util.List;

/**
 * The {@code GET /api/analytics/expense-trends} JSON, for Expense Analytics: the chosen period, or
 * the last 12 calendar months (UTC), for every expense or only those with the first tag asked for.
 * {@code granularity} and {@code buckets} are as in SalesTrends, and the lists line up with
 * {@code buckets}. Restocks are expense lines linked to an item and running costs the rest, as in
 * the month breakdown; revenue (every sale, whatever the tag) is there for profit.
 * {@code expenseSeries} is spending over time by first tag: the top 3 tags, then "Other", like
 * the summary's. {@code byTag} is spending by first tag over the whole period, largest first, with
 * tags past the top 6 folded into "Other", listed last. Money is in the account's currency.
 */
public record ExpenseTrends(
        String granularity,
        List<String> buckets,
        List<String> bucketLabels,
        List<Long> revenueCents,
        List<Long> restockCents,
        List<Long> runningCents,
        List<TagSeries> expenseSeries,
        List<TagTotal> byTag) {}
