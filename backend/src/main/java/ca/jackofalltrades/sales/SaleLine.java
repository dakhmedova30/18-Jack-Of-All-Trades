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

    void setSale(Sale sale) {
        this.sale = sale;
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
