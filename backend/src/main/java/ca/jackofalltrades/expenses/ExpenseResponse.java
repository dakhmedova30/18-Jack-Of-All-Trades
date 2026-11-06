package ca.jackofalltrades.expenses;

import java.time.Instant;
import java.math.BigDecimal;
import java.util.List;

/** The {@code Expense} JSON in contract §5. {@code totalCents} is the sum of the lines. */
public record ExpenseResponse(
        Integer id,
        Instant incurredAt,
        String description,
        List<String> tags,
        long totalCents,
        List<ExpenseLineResponse> items,
        Instant createdAt,
        Instant updatedAt,
        String currency,
        BigDecimal originalAmount,
        String originalCurrency) {

    static ExpenseResponse from(Expense expense) {
        List<ExpenseLineResponse> lines = expense.getLines().stream().map(ExpenseLineResponse::from).toList();
        return of(expense.getId(), expense.getIncurredAt(), expense.getDescription(),
                List.copyOf(expense.getTags()), lines, expense.getCreatedAt(), expense.getUpdatedAt(),
                expense.getCurrency(), expense.getOriginalAmount(), expense.getOriginalCurrency());
    }

    static ExpenseResponse of(Integer id, Instant incurredAt, String description, List<String> tags,
            List<ExpenseLineResponse> lines, Instant createdAt, Instant updatedAt,
            String currency, BigDecimal originalAmount, String originalCurrency) {
        long total = lines.stream().mapToLong(ExpenseLineResponse::totalCents).sum();
        return new ExpenseResponse(id, incurredAt, description, tags, total, lines, createdAt, updatedAt,
                currency, originalAmount, originalCurrency);
    }

    ExpenseResponse displayedIn(String targetCurrency, long convertedTotalCents) {
        return new ExpenseResponse(id, incurredAt, description, tags, convertedTotalCents, items, createdAt,
                updatedAt, targetCurrency, originalAmount, originalCurrency);
    }
}
