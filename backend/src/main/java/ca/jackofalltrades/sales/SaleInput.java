package ca.jackofalltrades.sales;

import ca.jackofalltrades.common.api.IsoOffsetDateTime;
import ca.jackofalltrades.common.api.Tags;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * {@code POST /api/sales} and {@code PATCH /api/sales/{id}} body (contract §4); PATCH replaces
 * the whole sale. Limits and messages follow the demo's sales.schema.ts. The compact
 * constructor trims before validation runs.
 */
public record SaleInput(
        @NotNull(message = "Required")
        @IsoOffsetDateTime
        String soldAt,

        @NotNull(message = "Required")
        @Positive(message = "Must be a positive number")
        Integer channelId,

        @Size(max = 200, message = "Description must be at most 200 characters")
        String description,

        @Size(max = 10, message = "At most 10 tags")
        List<@NotBlank(message = "Tags cannot be empty") @Size(max = 30, message = "Tags must be at most 30 characters") String> tags,

        @NotNull(message = "Required")
        @Size(min = 1, message = "A sale needs at least one item")
        @Size(max = 50, message = "At most 50 line items")
        List<@NotNull(message = "Required") @Valid Line> items) {

    public SaleInput {
        description = description == null ? "" : description.strip();
        tags = Tags.normalize(tags);
    }

    /** One line: which item and how many. The price is copied from the item by the server. */
    public record Line(
            @NotNull(message = "Required")
            @Positive(message = "Must be a positive number")
            Integer itemId,

            @NotNull(message = "Required")
            @Positive(message = "Must be a positive number")
            Integer quantity) {}
}
