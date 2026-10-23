package ca.jackofalltrades.items;

import java.time.Instant;
import java.util.List;

/** The {@code Item} JSON in contract §3. */
public record ItemResponse(
        Integer id,
        String name,
        int quantity,
        int unitPriceCents,
        List<String> tags,
        String note,
        Instant createdAt,
        Instant updatedAt) {

    static ItemResponse from(Item item) {
        return new ItemResponse(item.getId(), item.getName(), item.getQuantity(), item.getUnitPriceCents(),
                List.copyOf(item.getTags()), item.getNote(), item.getCreatedAt(), item.getUpdatedAt());
    }
}
