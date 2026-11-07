package ca.jackofalltrades.markets;

import ca.jackofalltrades.common.api.Tags;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;

/** {@code POST /api/markets} and {@code PATCH /api/markets/{id}} body; PATCH replaces the whole market. */
public record MarketInput(
        @NotBlank(message = "Name is required")
        @Size(max = 120, message = "Name must be at most 120 characters")
        String name,

        @NotNull(message = "Required") LocalDate startDate,
        @NotNull(message = "Required") LocalDate endDate,

        @Size(max = 200, message = "Location must be at most 200 characters")
        String location,

        @NotNull(message = "Required")
        @Min(value = 0, message = "Cannot be negative")
        @Max(value = 999_999_999, message = "Amount is too large")
        Integer tableFeeCents,

        @NotNull(message = "Required")
        @Min(value = 0, message = "Cannot be negative")
        @Max(value = 999_999_999, message = "Amount is too large")
        Integer extraExpensesCents,

        @NotNull(message = "Required")
        @Pattern(regexp = "CAD|USD|EUR|GBP|AUD", message = "Currency must be one of: CAD, USD, EUR, GBP, AUD")
        String currency,

        @Size(max = 300, message = "Website must be at most 300 characters")
        String website,

        @NotNull(message = "Required")
        @Pattern(regexp = "PENDING|ACCEPTED|WAITLISTED|REJECTED", message = "Invalid status")
        String status,

        @NotNull(message = "Required")
        @Pattern(regexp = "PENDING|YES|NO", message = "Must be one of PENDING, YES, NO")
        String going,

        @Size(max = 10, message = "At most 10 tags")
        List<@NotBlank(message = "Tags cannot be empty") @Size(max = 30, message = "Tags must be at most 30 characters") String> tags) {

    public MarketInput {
        name = name == null ? null : name.strip();
        location = location == null ? "" : location.strip();
        website = website == null || website.isBlank() ? null : website.strip();
        tags = Tags.normalize(tags);
    }
}
