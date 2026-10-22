package ca.jackofalltrades.items;

import ca.jackofalltrades.common.api.Tags;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * {@code PATCH /api/items/{id}} body (contract §3): a partial {@link ItemInput} with the same
 * limits. A null field (omitted, or sent as null) is left unchanged, so defaults aren't applied.
 */
public record ItemUpdate(
        @Size(min = 1, message = "Name is required")
        @Size(max = 120, message = "Name must be at most 120 characters")
        String name,

        @Min(value = 0, message = "Quantity cannot be negative")
        Integer quantity,

        @Min(value = 0, message = "Price cannot be negative")
        Integer unitPriceCents,

        @Size(max = 10, message = "At most 10 tags")
        List<@NotBlank(message = "Tags cannot be empty") @Size(max = 30, message = "Tags must be at most 30 characters") String> tags,

        @Size(max = 1000, message = "Note must be at most 1000 characters")
        String note) {

    public ItemUpdate {
        name = name == null ? null : name.strip();
        tags = tags == null ? null : Tags.normalize(tags);
    }

    boolean isEmpty() {
        return name == null && quantity == null && unitPriceCents == null && tags == null && note == null;
    }
}
