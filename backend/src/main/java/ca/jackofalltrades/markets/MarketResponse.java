package ca.jackofalltrades.markets;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** A market plus its computed figures, all in the market's own currency. */
public record MarketResponse(
        Integer id,
        String name,
        LocalDate startDate,
        LocalDate endDate,
        String location,
        int tableFeeCents,
        int extraExpensesCents,
        String currency,
        String website,
        String status,
        String going,
        List<String> tags,
        long expensesCents,
        long revenueCents,
        long tipsCents,
        int salesCount,
        long profitCents,
        Instant createdAt,
        Instant updatedAt) {}
