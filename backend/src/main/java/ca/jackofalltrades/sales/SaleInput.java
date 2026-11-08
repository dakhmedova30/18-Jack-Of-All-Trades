package ca.jackofalltrades.sales;

import ca.jackofalltrades.common.api.IsoOffsetDateTime;
import ca.jackofalltrades.common.api.Tags;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
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
        @Size(max = 50, message = "At most 50 line items")
        List<@NotNull(message = "Required") @Valid Line> items,

        @Positive(message = "Must be a positive number")
        Integer marketId,

        @Pattern(regexp = "CAD|USD|EUR|GBP|AUD", message = "Currency must be one of: CAD, USD, EUR, GBP, AUD")
        String currency,

        @Min(value = 1, message = "Tip must be at least 0.01")
        @Max(value = 999_999_999, message = "Tip is too large")
        Integer tipCents,

        @Size(max = 10, message = "At most 10 discounts or charges")
        List<@NotNull(message = "Required") @Positive(message = "Must be a positive number") Integer> discountIds,

        @Positive(message = "Must be a positive number")
        Integer commissionId) {

    public SaleInput {
        description = description == null ? "" : description.strip();
        tags = Tags.normalize(tags);
        discountIds = discountIds == null ? List.of() : List.copyOf(discountIds);
    }

    public SaleInput(String soldAt, Integer channelId, String description, List<String> tags, List<Line> items) {
        this(soldAt, channelId, description, tags, items, null, null, null, null, null);
    }

    /**
     * One line: which item and how many. The price is copied from the item by the server unless
     * {@code unitPriceCents} changes it; free and trade lines bring in no money.
     */
    public record Line(
            @NotNull(message = "Required")
            @Positive(message = "Must be a positive number")
            Integer itemId,

            @NotNull(message = "Required")
            @Positive(message = "Must be a positive number")
            Integer quantity,

            @Min(value = 0, message = "Price cannot be negative")
            @Max(value = 999_999_999, message = "Price is too large")
            Integer unitPriceCents,

            Boolean isFree,

            Boolean isTrade) {

        public Line(Integer itemId, Integer quantity) {
            this(itemId, quantity, null, null, null);
        }
    }
}
