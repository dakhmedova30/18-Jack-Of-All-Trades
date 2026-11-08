package ca.jackofalltrades.sales;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * One line of a sale ({@code sale_items}). The item's name and price are copied at sale time;
 * {@code itemId} becomes null if the item is later deleted.
 */
@Entity
@Table(name = "sale_items")
public class SaleLine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sale_id", nullable = false)
    private Sale sale;

    private Integer itemId;

    @Column(nullable = false)
    private String itemName;

    @Column(nullable = false)
    private int quantity;

    @Column(nullable = false)
    private int unitPriceCents;

    @Column(nullable = false)
    private int totalCents;

    @Column(nullable = false)
    private String kind = "ITEM";

    @Column(name = "is_free", nullable = false)
    private boolean free;

    @Column(name = "is_trade", nullable = false)
    private boolean trade;

    private Integer discountId;

    protected SaleLine() {
        // for JPA
    }

    SaleLine(Integer itemId, String itemName, int quantity, int unitPriceCents, int totalCents) {
        this.itemId = itemId;
        this.itemName = itemName;
        this.quantity = quantity;
        this.unitPriceCents = unitPriceCents;
        this.totalCents = totalCents;
    }

    /** A sold item that may be free or a trade (both count as no revenue). */
    SaleLine(Integer itemId, String itemName, int quantity, int unitPriceCents, int totalCents, boolean free,
            boolean trade) {
        this(itemId, itemName, quantity, unitPriceCents, totalCents);
        this.free = free;
        this.trade = trade;
    }

    /** A discount, charge or tip line: no item, quantity 1, and a signed amount. */
    static SaleLine adjustment(String kind, String name, int amountCents, Integer discountId) {
        SaleLine line = new SaleLine(null, name, 1, amountCents, amountCents);
        line.kind = kind;
        line.discountId = discountId;
        return line;
    }

    void setSale(Sale sale) {
        this.sale = sale;
    }

    public String getKind() {
        return kind;
    }

    public boolean isFree() {
        return free;
    }

    public boolean isTrade() {
        return trade;
    }

    public Integer getDiscountId() {
        return discountId;
    }

    public Integer getId() {
        return id;
    }

    public Integer getItemId() {
        return itemId;
    }

    public String getItemName() {
        return itemName;
    }

    public int getQuantity() {
        return quantity;
    }

    public int getUnitPriceCents() {
        return unitPriceCents;
    }

    public int getTotalCents() {
        return totalCents;
    }
}
