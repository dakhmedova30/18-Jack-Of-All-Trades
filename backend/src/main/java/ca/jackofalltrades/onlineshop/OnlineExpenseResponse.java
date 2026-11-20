package ca.jackofalltrades.onlineshop;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record OnlineExpenseResponse(
        Integer id,
        LocalDate spentOn,
        String description,
        String category,
        int amountCents,
        String currency,
        List<String> tags,
        Instant createdAt,
        Instant updatedAt) {}
