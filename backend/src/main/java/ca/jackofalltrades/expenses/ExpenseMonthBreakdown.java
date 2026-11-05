package ca.jackofalltrades.expenses;

import java.time.Instant;
import java.util.List;

/**
 * The {@code ExpenseMonthBreakdown} JSON in contract §5: this UTC month's spending,
 * {@code [periodStart, periodEnd)}, split into restocks (lines linked to an item) and running
 * costs (lines without one), plus the top 5 restocked items by spend.
 */
public record ExpenseMonthBreakdown(
        Instant periodStart,
        Instant periodEnd,
        long restockCents,
        long runningCents,
        long totalCents,
        List<TopRestockItem> topRestockItems) {

    public record TopRestockItem(Integer id, String name, long units, long spentCents) {}
}
