package ca.jackofalltrades.expenses;

import ca.jackofalltrades.common.api.IsoOffsetDateTime;
import ca.jackofalltrades.common.api.Tags;
import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.util.List;

/**
 * {@code POST /api/expenses} and {@code PATCH /api/expenses/{id}} body (contract §5); PATCH
 * replaces the whole expense. Limits and messages follow the demo's expenses.schema.ts. The
 * compact constructors trim before validation runs.
 */
public record ExpenseInput(
        @NotNull(message = "Required")
        @IsoOffsetDateTime
        String incurredAt,

        @Size(max = 200, message = "Description must be at most 200 characters")
        String description,

        @Size(max = 10, message = "At most 10 tags")
        List<@NotBlank(message = "Tags cannot be empty") @Size(max = 30, message = "Tags must be at most 30 characters") String> tags,

        @Pattern(regexp = "CAD|USD|EUR|GBP|AUD", message = "Currency must be one of: CAD, USD, EUR, GBP, AUD")
        String currency,

        @NotNull(message = "Required")
        @Size(min = 1, message = "An expense needs at least one line")
        @Size(max = 50, message = "At most 50 line items")
        List<@NotNull(message = "Required") @Valid Line> items) {

    public ExpenseInput(String incurredAt, String description, List<String> tags, List<Line> items) {
        this(incurredAt, description, tags, null, items);
    }

    public ExpenseInput {
        description = description == null ? "" : description.strip();
        tags = Tags.normalize(tags);
    }

    /**
     * One line: either restocks an item ({@code itemId}) or is a plain cost described in
     * {@code description}, e.g. "Rent". When both are given, the item wins, as in the demo.
     */
    @ItemOrDescription
    public record Line(
            @Positive(message = "Must be a positive number")
            Integer itemId,

            @Size(max = 120, message = "Description must be at most 120 characters")
            String description,

            @NotNull(message = "Required")
            @Positive(message = "Must be a positive number")
            Integer quantity,

            @NotNull(message = "Required")
            @PositiveOrZero(message = "Cost must be between 0.00 and 9,999,999.99")
            @Max(value = 999_999_999, message = "Cost must be between 0.00 and 9,999,999.99")
            Integer unitCostCents,

            @Size(max = 60, message = "Category must be at most 60 characters")
            String category,

            @Size(max = 60, message = "Sub-category must be at most 60 characters")
            String subcategory,

            @Size(max = 100, message = "Manufacturer must be at most 100 characters")
            String manufacturer,

            @Pattern(regexp = "product|shipping|fee|other", message = "Type must be product, shipping, fee, or other")
            String type) {

        public Line(Integer itemId, String description, Integer quantity, Integer unitCostCents) {
            this(itemId, description, quantity, unitCostCents, null, null, null, null);
        }

        public Line {
            description = description == null ? "" : description.strip();
            category = category == null ? "" : category.strip();
            subcategory = subcategory == null ? "" : subcategory.strip();
            manufacturer = manufacturer == null ? "" : manufacturer.strip();
            type = type == null || type.isBlank() ? null : type.strip().toLowerCase();
        }
    }

    /** A line needs an {@code itemId} or a non-blank {@code description}; reported on {@code description}. */
    @Target(ElementType.TYPE)
    @Retention(RetentionPolicy.RUNTIME)
    @Constraint(validatedBy = ItemOrDescription.Validator.class)
    public @interface ItemOrDescription {

        String message() default "Pick an item or enter a description";

        Class<?>[] groups() default {};

        Class<? extends Payload>[] payload() default {};

        class Validator implements ConstraintValidator<ItemOrDescription, Line> {
            @Override
            public boolean isValid(Line line, ConstraintValidatorContext context) {
                if (line == null || line.itemId() != null || !line.description().isEmpty()) {
                    return true;
                }
                // On the field, so the error's path is items.N.description, as in the demo.
                context.disableDefaultConstraintViolation();
                context.buildConstraintViolationWithTemplate(context.getDefaultConstraintMessageTemplate())
                        .addPropertyNode("description")
                        .addConstraintViolation();
                return false;
            }
        }
    }
}
