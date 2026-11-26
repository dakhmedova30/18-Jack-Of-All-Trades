package ca.jackofalltrades.onlineshop;

import ca.jackofalltrades.common.api.Tags;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;

/** {@code POST /api/online-shop/expenses} and {@code PATCH .../{id}} body; PATCH replaces the whole entry. */
public record OnlineExpenseInput(
        @NotNull(message = "Required") LocalDate spentOn,

        @Size(max = 200, message = "Description must be at most 200 characters")
        String description,

        @Size(max = 60, message = "Category must be at most 60 characters")
        String category,

        @NotNull(message = "Required")
        @Min(value = 0, message = "Cannot be negative")
        @Max(value = 999_999_999, message = "Amount is too large")
        Integer amountCents,

        @NotNull(message = "Required")
        @Pattern(regexp = "CAD|USD|EUR|GBP|AUD", message = "Currency must be one of: CAD, USD, EUR, GBP, AUD")
        String currency,

        @Size(max = 10, message = "At most 10 tags")
        List<@NotBlank(message = "Tags cannot be empty") @Size(max = 30, message = "Tags must be at most 30 characters") String> tags) {

    public OnlineExpenseInput {
        description = description == null ? "" : description.strip();
        category = category == null ? "" : category.strip();
        tags = Tags.normalize(tags);
    }
}
