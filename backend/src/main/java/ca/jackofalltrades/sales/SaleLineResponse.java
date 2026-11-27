package ca.jackofalltrades.sales;

/**
 * One entry of a sale's {@code items} in contract §4. {@code itemId} is null once the item is deleted,
 * and for discount, charge and tip lines ({@code kind}).
 */
public record SaleLineResponse(
        Integer id, Integer itemId, String itemName, int quantity, int unitPriceCents, int totalCents,
        String kind, boolean isFree, boolean isTrade, Integer discountId) {

    static SaleLineResponse from(SaleLine line) {
        return new SaleLineResponse(line.getId(), line.getItemId(), line.getItemName(), line.getQuantity(),
                line.getUnitPriceCents(), line.getTotalCents(), line.getKind(), line.isFree(), line.isTrade(),
                line.getDiscountId());
    }
}
