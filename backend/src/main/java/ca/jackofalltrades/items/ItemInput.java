package ca.jackofalltrades.items;

import ca.jackofalltrades.common.api.Tags;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * {@code POST /api/items} body (contract §3). Limits and messages follow the demo's
 * items.schema.ts. The compact constructor trims before validation runs.
 */
public record ItemInput(
        @NotNull(message = "Required")
        @Size(min = 1, message = "Name is required")
        @Size(max = 120, message = "Name must be at most 120 characters")
        String name,

        @NotNull(message = "Required")
        @Min(value = 0, message = "Quantity cannot be negative")
        Integer quantity,

        @NotNull(message = "Required")
        @Min(value = 0, message = "Price cannot be negative")
        Integer unitPriceCents,

        @Size(max = 10, message = "At most 10 tags")
        List<@NotBlank(message = "Tags cannot be empty") @Size(max = 30, message = "Tags must be at most 30 characters") String> tags,

        @Size(max = 1000, message = "Note must be at most 1000 characters")
        String note) {

    public ItemInput {
        name = name == null ? null : name.strip();
        tags = Tags.normalize(tags);
        note = note == null ? "" : note;
    }
}
