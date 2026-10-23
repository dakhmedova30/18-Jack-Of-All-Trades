package ca.jackofalltrades.expenses;

import ca.jackofalltrades.common.api.IsoOffsetDateTime;
import ca.jackofalltrades.common.api.Tags;
import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
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

        @NotNull(message = "Required")
        @Size(min = 1, message = "An expense needs at least one line")
        @Size(max = 50, message = "At most 50 line items")
        List<@NotNull(message = "Required") @Valid Line> items) {

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
            @PositiveOrZero(message = "Cost cannot be negative")
            Integer unitCostCents) {

        public Line {
            description = description == null ? "" : description.strip();
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
