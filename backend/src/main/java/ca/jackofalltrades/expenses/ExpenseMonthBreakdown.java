package ca.jackofalltrades.expenses;

import java.time.Instant;
import java.util.List;

/**
 * The {@code ExpenseMonthBreakdown} JSON in contract §5: this UTC month's spending,
 * {@code [periodStart, periodEnd)}, split into restocks (lines linked to an item) and running
 * costs (lines without one); last month's whole total, to compare with; the month's largest
 * expense (null with none); and the top 5 restocked items by spend.
 */
public record ExpenseMonthBreakdown(
        Instant periodStart,
        Instant periodEnd,
        long restockCents,
        long runningCents,
        long totalCents,
        long previousTotalCents,
        LargestExpense largestExpense,
        List<TopRestockItem> topRestockItems) {

    public record TopRestockItem(Integer id, String name, long units, long spentCents) {}

    /** One expense: the sum of its lines, in the account's currency. */
    public record LargestExpense(Integer id, Instant incurredAt, String description, long totalCents) {}
}
