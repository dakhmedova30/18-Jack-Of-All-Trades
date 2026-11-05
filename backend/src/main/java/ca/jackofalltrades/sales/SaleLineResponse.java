package ca.jackofalltrades.sales;

/** One entry of a sale's {@code items} in contract §4. {@code itemId} is null once the item is deleted. */
public record SaleLineResponse(
        Integer id, Integer itemId, String itemName, int quantity, int unitPriceCents, int totalCents) {

    static SaleLineResponse from(SaleLine line) {
        return new SaleLineResponse(line.getId(), line.getItemId(), line.getItemName(), line.getQuantity(),
                line.getUnitPriceCents(), line.getTotalCents());
    }
}
