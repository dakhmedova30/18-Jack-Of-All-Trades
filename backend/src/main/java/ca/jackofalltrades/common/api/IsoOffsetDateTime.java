package ca.jackofalltrades.common.api;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;

/**
 * An ISO-8601 timestamp with an offset, e.g. {@code 2026-10-18T15:30:00-04:00} or {@code …Z},
 * like the demo's {@code z.iso.datetime({ offset: true })}. {@code null} is valid; pair with
 * {@code @NotNull}.
 *
 * <p>The field stays a {@code String} so a bad value is a validation error on that field. If
 * Jackson parsed it into an {@code OffsetDateTime}, it would be "Request body is not valid JSON".
 */
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = IsoOffsetDateTime.Validator.class)
public @interface IsoOffsetDateTime {

    String message() default "Enter a date and time with a time zone offset";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};

    class Validator implements ConstraintValidator<IsoOffsetDateTime, String> {
        @Override
        public boolean isValid(String value, ConstraintValidatorContext context) {
            if (value == null) {
                return true;
            }
            try {
                OffsetDateTime.parse(value);
                return true;
            } catch (DateTimeParseException e) {
                return false;
            }
        }
    }
}
