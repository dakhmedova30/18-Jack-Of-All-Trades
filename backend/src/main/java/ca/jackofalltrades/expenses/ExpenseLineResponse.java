package ca.jackofalltrades.expenses;

/**
 * One entry of an expense's {@code items} in contract §5. {@code itemId} is null for a plain cost,
 * and once a restocked item is deleted.
 */
public record ExpenseLineResponse(
        Integer id, Integer itemId, String itemName, int quantity, int unitCostCents, int totalCents) {

    static ExpenseLineResponse from(ExpenseLine line) {
        return new ExpenseLineResponse(line.getId(), line.getItemId(), line.getItemName(), line.getQuantity(),
                line.getUnitCostCents(), line.getTotalCents());
    }
}
