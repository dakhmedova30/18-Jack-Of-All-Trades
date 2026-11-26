package ca.jackofalltrades.expenses;

import java.time.Instant;

/** A classified expense line with the transaction needed to open or trace its source. */
public record ExpenseLineReportResponse(
        Integer lineId,
        Integer expenseId,
        Instant incurredAt,
        String expenseDescription,
        String currency,
        String originalCurrency,
        String itemName,
        int quantity,
        int unitCostCents,
        long totalCents,
        long displayTotalCents,
        String category,
        String subcategory,
        String manufacturer,
        String type) {

    ExpenseLineReportResponse displayedIn(String targetCurrency, long convertedTotalCents) {
        return new ExpenseLineReportResponse(lineId, expenseId, incurredAt, expenseDescription, targetCurrency,
                originalCurrency, itemName, quantity, unitCostCents, totalCents, convertedTotalCents,
                category, subcategory, manufacturer, type);
    }
}
