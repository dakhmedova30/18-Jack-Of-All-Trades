package ca.jackofalltrades.analytics;

import java.util.List;

/**
 * The {@code GET /api/analytics/stock-health} JSON, for Inventory Analytics. A snapshot of stock now:
 * how many items are out of stock, low (1 to {@code lowStockThreshold}) or well stocked; stock
 * value at selling price by first tag (top 7, then "Other"); and the items that will run out soonest
 * at their pace over the last {@code paceDays} days (UTC, today included).
 */
public record StockHealth(
        int lowStockThreshold,
        long outOfStockCount,
        long lowStockCount,
        long wellStockedCount,
        List<TagValue> valueByTag,
        int paceDays,
        List<RunningOutItem> runningOut) {

    public record TagValue(String label, long valueCents, long quantity, long itemCount) {}

    /**
     * @param unitsSold units sold in the last {@code paceDays} days
     * @param daysLeft days until it runs out if it keeps selling at that pace, to one decimal; 0 when out
     */
    public record RunningOutItem(Integer id, String name, int quantity, long unitsSold, double daysLeft) {}
}
