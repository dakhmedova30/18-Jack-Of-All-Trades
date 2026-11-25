package ca.jackofalltrades.discounts;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

/** {@code POST /api/discounts} and {@code PATCH /api/discounts/{id}} body; PATCH replaces the whole discount. */
public record DiscountInput(
        @NotBlank(message = "Name is required")
        @Size(max = 80, message = "Name must be at most 80 characters")
        String name,

        @Size(max = 30, message = "Applies-to tag must be at most 30 characters")
        String appliesTo,

        @NotNull(message = "Required")
        @Pattern(regexp = "PRESET|PER_AMOUNT|SOLID", message = "Must be one of PRESET, PER_AMOUNT, SOLID")
        String kind,

        Boolean isCharge,

        @Pattern(regexp = "AMOUNT|PERCENT", message = "Must be one of AMOUNT, PERCENT")
        String valueType,

        @Min(value = 0, message = "Value cannot be negative")
        BigDecimal value,

        @Min(value = 1, message = "Must be at least 1")
        @Max(value = 1000, message = "Must be at most 1000")
        Integer buyCount,

        @Min(value = 1, message = "Must be at least 1")
        @Max(value = 1000, message = "Must be at most 1000")
        Integer getCount,

        @Size(max = 20, message = "At most 20 price breaks")
        List<@NotNull(message = "Required") @Valid Tier> tiers,

        @Pattern(regexp = "CAD|USD|EUR|GBP|AUD", message = "Currency must be one of: CAD, USD, EUR, GBP, AUD")
        String currency) {

    public DiscountInput {
        name = name == null ? null : name.strip();
        appliesTo = appliesTo == null || appliesTo.isBlank() ? null : appliesTo.strip();
        tiers = tiers == null ? List.of() : List.copyOf(tiers);
    }

    public record Tier(
            @NotNull(message = "Required")
            @Min(value = 1, message = "Must be at least 1")
            @Max(value = 1000, message = "Must be at most 1000")
            Integer count,

            @NotNull(message = "Required")
            @Min(value = 0, message = "Price cannot be negative")
            @Max(value = 999_999_999, message = "Price is too large")
            Integer priceCents) {}
}
