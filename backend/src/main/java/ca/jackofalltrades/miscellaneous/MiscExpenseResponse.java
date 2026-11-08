package ca.jackofalltrades.miscellaneous;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record MiscExpenseResponse(
        Integer id,
        Integer miscId,
        LocalDate spentOn,
        String description,
        String category,
        int amountCents,
        String currency,
        List<String> tags,
        Instant createdAt,
        Instant updatedAt) {}
