package ca.jackofalltrades.items;

import java.time.Instant;
import java.util.List;

/**
 * The {@code InventoryInsights} JSON in contract §3: stock value at selling price, the top 3 items
 * by units sold this UTC month, {@code [periodStart, periodEnd)}, and the in-stock items with no
 * sales in that month.
 */
public record InventoryInsights(
        long stockValueCents,
        long totalUnits,
        Instant periodStart,
        Instant periodEnd,
        List<BestSeller> bestSellers,
        List<NotSellingItem> notSelling) {

    public record BestSeller(Integer id, String name, long unitsSold, long revenueCents) {}

    public record NotSellingItem(Integer id, String name, int quantity) {}
}
