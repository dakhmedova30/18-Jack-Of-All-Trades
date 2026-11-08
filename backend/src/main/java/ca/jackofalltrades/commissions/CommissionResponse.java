package ca.jackofalltrades.commissions;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** Commission summary. Amounts are converted to the business's display currency. */
public record CommissionResponse(
        Integer id,
        String name,
        String contact,
        String request,
        LocalDate deadline,
        List<String> tags,
        int salesCount,
        long expensesCents,
        long revenueCents,
        long profitCents,
        String currency,
        Instant createdAt,
        Instant updatedAt) {}
