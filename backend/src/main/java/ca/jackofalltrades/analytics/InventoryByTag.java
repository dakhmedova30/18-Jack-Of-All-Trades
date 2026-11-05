package ca.jackofalltrades.analytics;

import java.util.List;

/** The {@code GET /api/analytics/inventory} JSON (contract §6): current stock by first tag. */
public record InventoryByTag(List<TagStock> byTag, long totalQuantity, long totalItems) {

    public record TagStock(String label, long quantity, long itemCount) {}
}
