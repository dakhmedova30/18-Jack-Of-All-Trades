package ca.jackofalltrades.discounts;

import static org.assertj.core.api.Assertions.assertThat;

import ca.jackofalltrades.discounts.DiscountCalculator.Rule;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class DiscountCalculatorTest {

    @Test
    void solidPercentTakesAShareOfTheSubtotal() {
        Rule rule = new Rule("SOLID", new BigDecimal("10"), 0, 0, 0, Map.of());
        assertThat(DiscountCalculator.amountOffCents(rule, List.of(1000, 500))).isEqualTo(150);
    }

    @Test
    void solidAmountIsCappedAtTheSubtotal() {
        Rule rule = new Rule("SOLID", null, 5000, 0, 0, Map.of());
        assertThat(DiscountCalculator.amountOffCents(rule, List.of(1000, 500))).isEqualTo(1500);
    }

    @Test
    void buyTwoGetOneFreeDiscountsTheCheapestOfEachGroup() {
        Rule rule = new Rule("PRESET", new BigDecimal("100"), 0, 2, 1, Map.of());
        assertThat(DiscountCalculator.amountOffCents(rule, List.of(500, 1000, 700, 300))).isEqualTo(500);
    }

    @Test
    void perAmountBundlesUseTheBiggestTierThatFits() {
        Rule rule = new Rule("PER_AMOUNT", null, 0, 0, 0, Map.of(1, 1500L, 2, 2500L));
        assertThat(DiscountCalculator.amountOffCents(rule, List.of(1500, 1500, 1500))).isEqualTo(500);
    }

    @Test
    void nothingEligibleMeansNoDiscount() {
        Rule rule = new Rule("SOLID", new BigDecimal("10"), 0, 0, 0, Map.of());
        assertThat(DiscountCalculator.amountOffCents(rule, List.of())).isZero();
    }
}
