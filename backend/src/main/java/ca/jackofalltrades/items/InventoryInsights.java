package ca.jackofalltrades.items;

import java.time.Instant;
import java.util.List;

/**
 * The {@code InventoryInsights} JSON in contract §3: stock value at selling price, and the top 3
 * items by units sold this UTC month, {@code [periodStart, periodEnd)}.
 */
public record InventoryInsights(
        long stockValueCents,
        long totalUnits,
        Instant periodStart,
        Instant periodEnd,
        List<BestSeller> bestSellers) {

    public record BestSeller(Integer id, String name, long unitsSold, long revenueCents) {}
}
