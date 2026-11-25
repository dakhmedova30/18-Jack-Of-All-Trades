package ca.jackofalltrades.miscellaneous;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record MiscellaneousResponse(
        Integer id,
        String name,
        LocalDate receivedOn,
        List<String> tags,
        int salesCount,
        long expensesCents,
        long revenueCents,
        long profitCents,
        String currency,
        Instant createdAt,
        Instant updatedAt) {}
