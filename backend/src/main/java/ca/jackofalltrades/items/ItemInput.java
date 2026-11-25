package ca.jackofalltrades.items;

import ca.jackofalltrades.common.api.Tags;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
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
        @Min(value = 0, message = "Price must be between 0.00 and 9,999,999.99")
        @Max(value = 999_999_999, message = "Price must be between 0.00 and 9,999,999.99")
        Integer unitPriceCents,

        @Size(max = 10, message = "At most 10 tags")
        List<@NotBlank(message = "Tags cannot be empty") @Size(max = 30, message = "Tags must be at most 30 characters") String> tags,

        @Size(max = 1000, message = "Note must be at most 1000 characters")
        String note,

        /** Optional; omitted means private. */
        Boolean isPublic,

        /** Optional; omitted means the business currency. */
        @Pattern(regexp = ItemUpdate.CURRENCY_PATTERN, message = "Currency must be one of: CAD, USD, EUR, GBP, AUD")
        String currency,

        /** Size is optional, but width, height and unit go together. */
        @DecimalMin(value = "0.01", message = "Width must be greater than 0")
        @DecimalMax(value = "99999.99", message = "Width is too large")
        BigDecimal width,

        @DecimalMin(value = "0.01", message = "Height must be greater than 0")
        @DecimalMax(value = "99999.99", message = "Height is too large")
        BigDecimal height,

        @Pattern(regexp = "in|cm|mm|ft", message = "Unit must be one of: in, cm, mm, ft")
        String sizeUnit,

        /** Optional starting count of units already sold; omitted means 0. */
        @Min(value = 0, message = "Amount sold cannot be negative")
        Integer amountSold,

        /** Optional; omitted means active. */
        Boolean isActive) {

    public ItemInput {
        name = name == null ? null : name.strip();
        tags = Tags.normalize(tags);
        note = note == null ? "" : note;
        isPublic = isPublic != null && isPublic;
        currency = currency == null ? null : currency.strip().toUpperCase();
        amountSold = amountSold == null ? 0 : amountSold;
        isActive = isActive == null || isActive;
    }

    /** Fields the demo seed and tests don't care about take their defaults. */
    public ItemInput(String name, Integer quantity, Integer unitPriceCents, List<String> tags, String note,
            Boolean isPublic) {
        this(name, quantity, unitPriceCents, tags, note, isPublic, null, null, null, null, null, null);
    }

    @AssertTrue(message = "Width, height and unit must all be set, or all left blank")
    boolean isSizeComplete() {
        return (width == null) == (height == null) && (width == null) == (sizeUnit == null);
    }
}
