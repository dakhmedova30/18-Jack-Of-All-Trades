package ca.jackofalltrades.sales;

import java.time.Instant;

/**
 * The {@code SalesMonthSummary} JSON in contract §4: this UTC month, {@code [periodStart, periodEnd)}.
 * {@code largestSale} is null and {@code averageSaleCents} is 0 when there are no sales.
 */
public record SalesMonthSummary(
        Instant periodStart,
        Instant periodEnd,
        long saleCount,
        long revenueCents,
        long averageSaleCents,
        LargestSale largestSale) {

    public record LargestSale(Integer id, Instant soldAt, long totalCents) {}
}
