package ca.jackofalltrades.discounts;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record DiscountResponse(
        Integer id,
        String name,
        String appliesTo,
        String kind,
        boolean isCharge,
        String valueType,
        BigDecimal value,
        Integer buyCount,
        Integer getCount,
        List<DiscountInput.Tier> tiers,
        String currency,
        Instant createdAt,
        Instant updatedAt) {}
