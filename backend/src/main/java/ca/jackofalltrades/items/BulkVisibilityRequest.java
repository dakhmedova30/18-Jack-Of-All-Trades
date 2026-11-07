package ca.jackofalltrades.items;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * {@code POST /api/items/bulk-visibility} body (contract §3): 1–100 ids, and whether they go on the
 * public profile ({@code true}) or come off it ({@code false}).
 */
public record BulkVisibilityRequest(
        @NotNull(message = "Select at least one item")
        @Size(min = 1, message = "Select at least one item")
        @Size(max = 100, message = "At most 100 items")
        List<@NotNull(message = "Required") @Positive(message = "Must be a positive number") Integer> ids,

        @NotNull(message = "Required")
        Boolean isPublic) {}
