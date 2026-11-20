package ca.jackofalltrades.items;

import ca.jackofalltrades.common.api.Tags;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
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

        @Min(value = 0, message = "Price must be between 0.00 and 9,999,999.99")
        @Max(value = 999_999_999, message = "Price must be between 0.00 and 9,999,999.99")
        Integer unitPriceCents,

        @Size(max = 10, message = "At most 10 tags")
        List<@NotBlank(message = "Tags cannot be empty") @Size(max = 30, message = "Tags must be at most 30 characters") String> tags,

        @Size(max = 1000, message = "Note must be at most 1000 characters")
        String note,

        Boolean isPublic,

        @Pattern(regexp = CURRENCY_PATTERN, message = "Currency must be one of: CAD, USD, EUR, GBP, AUD")
        String currency,

        @DecimalMin(value = "0.01", message = "Width must be greater than 0")
        @DecimalMax(value = "99999.99", message = "Width is too large")
        BigDecimal width,

        @DecimalMin(value = "0.01", message = "Height must be greater than 0")
        @DecimalMax(value = "99999.99", message = "Height is too large")
        BigDecimal height,

        @Pattern(regexp = "in|cm|mm|ft", message = "Unit must be one of: in, cm, mm, ft")
        String sizeUnit,

        /** Send true to remove the size; otherwise width, height and unit change together. */
        Boolean clearSize,

        @Min(value = 0, message = "Amount sold cannot be negative")
        Integer amountSold,

        Boolean isActive) {

    static final String CURRENCY_PATTERN = "(?i)CAD|USD|EUR|GBP|AUD";

    public ItemUpdate {
        name = name == null ? null : name.strip();
        tags = tags == null ? null : Tags.normalize(tags);
        currency = currency == null ? null : currency.strip().toUpperCase();
    }

    @AssertTrue(message = "Width, height and unit must all be set together")
    boolean isSizeComplete() {
        return (width == null) == (height == null) && (width == null) == (sizeUnit == null);
    }

    boolean isEmpty() {
        return name == null && quantity == null && unitPriceCents == null && tags == null && note == null
                && isPublic == null && currency == null && width == null && clearSize == null && amountSold == null
                && isActive == null;
    }
}
