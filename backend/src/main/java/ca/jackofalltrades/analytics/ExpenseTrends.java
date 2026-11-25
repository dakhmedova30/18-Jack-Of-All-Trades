package ca.jackofalltrades.analytics;

import ca.jackofalltrades.analytics.AnalyticsSummary.TagTotal;
import java.util.List;

/**
 * The {@code GET /api/analytics/expense-trends} JSON, for Expense Analytics: the last 12 calendar
 * months (UTC), this one included. The lists line up with {@code buckets} ("YYYY-MM"). Restocks
 * are expense lines linked to an item and running costs the rest, as in the month breakdown;
 * revenue is there to compare against. {@code byTag} is spending by first tag, largest first,
 * with tags past the top 6 folded into "Other", listed last. Money is in the account's currency.
 */
public record ExpenseTrends(
        List<String> buckets,
        List<String> bucketLabels,
        List<Long> revenueCents,
        List<Long> restockCents,
        List<Long> runningCents,
        List<TagTotal> byTag) {}
