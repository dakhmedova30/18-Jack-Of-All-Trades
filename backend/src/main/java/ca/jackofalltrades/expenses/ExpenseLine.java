package ca.jackofalltrades.expenses;

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
 * One line of an expense ({@code expense_items}): a restock of an item ({@code itemId} set), or
 * a plain cost such as "Rent" ({@code itemId} null, {@code itemName} is the description). The
 * item's name is copied when recorded; {@code itemId} becomes null if the item is later deleted.
 */
@Entity
@Table(name = "expense_items")
public class ExpenseLine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "expense_id", nullable = false)
    private Expense expense;

    private Integer itemId;

    @Column(nullable = false)
    private String itemName;

    @Column(nullable = false)
    private int quantity;

    @Column(nullable = false)
    private int unitCostCents;

    @Column(nullable = false)
    private int totalCents;

    protected ExpenseLine() {
        // for JPA
    }

    ExpenseLine(Integer itemId, String itemName, int quantity, int unitCostCents, int totalCents) {
        this.itemId = itemId;
        this.itemName = itemName;
        this.quantity = quantity;
        this.unitCostCents = unitCostCents;
        this.totalCents = totalCents;
    }

    void setExpense(Expense expense) {
        this.expense = expense;
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

    public int getUnitCostCents() {
        return unitCostCents;
    }

    public int getTotalCents() {
        return totalCents;
    }
}
