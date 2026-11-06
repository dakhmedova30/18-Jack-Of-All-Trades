package ca.jackofalltrades.items;

import java.time.Instant;
import java.math.BigDecimal;
import java.util.List;

/** The {@code Item} JSON in contract §3. */
public record ItemResponse(
        Integer id,
        String name,
        int quantity,
        int unitPriceCents,
        String currency,
        BigDecimal originalPrice,
        String originalCurrency,
        List<String> tags,
        String note,
        boolean isPublic,
        Instant createdAt,
        Instant updatedAt) {

    static ItemResponse from(Item item) {
        return new ItemResponse(item.getId(), item.getName(), item.getQuantity(), item.getUnitPriceCents(),
                item.getCurrency(), item.getOriginalPrice(), item.getOriginalCurrency(), List.copyOf(item.getTags()),
                item.getNote(), item.isPublic(), item.getCreatedAt(), item.getUpdatedAt());
    }
}
