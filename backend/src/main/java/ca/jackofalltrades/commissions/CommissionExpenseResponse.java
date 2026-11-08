package ca.jackofalltrades.commissions;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record CommissionExpenseResponse(
        Integer id,
        Integer commissionId,
        LocalDate spentOn,
        String description,
        String category,
        int amountCents,
        String currency,
        List<String> tags,
        Instant createdAt,
        Instant updatedAt) {}
