package ca.jackofalltrades.common.api;

import java.math.BigDecimal;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.core.JsonParser;
import tools.jackson.core.JsonToken;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.JacksonModule;
import tools.jackson.databind.deser.std.StdScalarDeserializer;
import tools.jackson.databind.module.SimpleModule;

/**
 * Whole numbers in request bodies (ids, quantities, cents; contract §1), read like the demo's
 * {@code z.number().int()}: {@code 2} and {@code 2.0} are 2, while {@code 2.7}, {@code "5"} or
 * anything else is rejected. Jackson's default would silently turn 2.7 into 2 and "5" into 5.
 * Rejections become "Must be a whole number" field errors in GlobalExceptionHandler.
 *
 * <p>Request records use {@code Integer} for whole numbers, so only {@code Integer} is replaced;
 * {@code spring.jackson} in application.yml makes primitives and {@code Long} strict as well.
 */
@Configuration
public class WholeNumbers {

    @Bean
    JacksonModule wholeNumberModule() {
        return new SimpleModule("whole-numbers").addDeserializer(Integer.class, new IntegerDeserializer());
    }

    static class IntegerDeserializer extends StdScalarDeserializer<Integer> {

        IntegerDeserializer() {
            super(Integer.class);
        }

        @Override
        public Integer deserialize(JsonParser p, DeserializationContext ctxt) {
            if (p.hasToken(JsonToken.VALUE_NUMBER_INT)) {
                return p.getIntValue();
            }
            if (p.hasToken(JsonToken.VALUE_NUMBER_FLOAT)) {
                BigDecimal value = p.getDecimalValue();
                try {
                    return value.intValueExact(); // 2.0 → 2; a fraction or an out-of-range value throws
                } catch (ArithmeticException notWhole) {
                    // falls through to the rejection below
                }
            }
            return (Integer) ctxt.handleUnexpectedToken(Integer.class, p);
        }
    }
}
