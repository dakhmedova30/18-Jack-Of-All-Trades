package ca.jackofalltrades.discounts;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/** Works out how much a discount takes off (or a charge adds to) a list of eligible unit prices. */
public final class DiscountCalculator {

    /**
     * A discount with every money value already in the sale's currency.
     *
     * @param percent null when the value is a fixed amount
     * @param tierCents bundle size to bundle price
     */
    public record Rule(String kind, BigDecimal percent, long amountCents, int buyCount, int getCount,
            Map<Integer, Long> tierCents) {}

    private DiscountCalculator() {}

    /** Positive cents to take off; 0 when nothing qualifies. Never more than the eligible subtotal. */
    public static long amountOffCents(Rule rule, List<Integer> eligibleUnitPrices) {
        if (eligibleUnitPrices.isEmpty()) {
            return 0;
        }
        List<Integer> prices = new ArrayList<>(eligibleUnitPrices);
        prices.sort(Comparator.reverseOrder());
        long subtotal = prices.stream().mapToLong(Integer::longValue).sum();
        long off = switch (rule.kind()) {
            case "SOLID" -> each(rule, subtotal);
            case "PRESET" -> presetOff(rule, prices);
            case "PER_AMOUNT" -> perAmountOff(rule, prices);
            default -> 0;
        };
        return Math.max(0, Math.min(off, subtotal));
    }

    /** Buy N, get M: in every full group of N + M items the M cheapest are discounted. */
    private static long presetOff(Rule rule, List<Integer> prices) {
        int group = rule.buyCount() + rule.getCount();
        long off = 0;
        for (int start = 0; start + group <= prices.size(); start += group) {
            for (int i = start + rule.buyCount(); i < start + group; i++) {
                off += each(rule, prices.get(i));
            }
        }
        return off;
    }

    /** Takes the biggest bundle that fits, repeatedly, starting with the dearest items. */
    private static long perAmountOff(Rule rule, List<Integer> prices) {
        TreeMap<Integer, Long> tiers = new TreeMap<>(rule.tierCents());
        long off = 0;
        int index = 0;
        while (index < prices.size()) {
            Map.Entry<Integer, Long> tier = tiers.floorEntry(prices.size() - index);
            if (tier == null) {
                break;
            }
            long regular = 0;
            for (int i = index; i < index + tier.getKey(); i++) {
                regular += prices.get(i);
            }
            off += Math.max(0, regular - tier.getValue());
            index += tier.getKey();
        }
        return off;
    }

    private static long each(Rule rule, long price) {
        if (rule.percent() != null) {
            return BigDecimal.valueOf(price).multiply(rule.percent())
                    .divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP).longValue();
        }
        return Math.min(rule.amountCents(), price);
    }
}
