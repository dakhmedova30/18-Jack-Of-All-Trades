package ca.jackofalltrades.items;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

/** A product in a business's inventory (contract §3). */
@Entity
@Table(name = "items")
public class Item {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, updatable = false)
    private Integer businessId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private int quantity;

    @Column(nullable = false)
    private int unitPriceCents;

    @Column(nullable = false, length = 3)
    private String currency;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal originalPrice;

    @Column(nullable = false, length = 3)
    private String originalCurrency;

    @Column(precision = 10, scale = 2)
    private BigDecimal width;

    @Column(precision = 10, scale = 2)
    private BigDecimal height;

    @Column(length = 2)
    private String sizeUnit;

    /** Units sold: starts from what the owner enters and moves with sales. */
    @Column(nullable = false)
    private int amountSold;

    /** Inactive items stay in history but can't be sold. */
    @Column(nullable = false)
    private boolean isActive = true;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(nullable = false)
    private List<String> tags;

    @Column(nullable = false)
    private String note;

    /** Shown on the business's public profile. New items start private. */
    @Column(nullable = false)
    private boolean isPublic;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;

    protected Item() {
        // for JPA
    }

    Item(Integer businessId, String name, int quantity, int unitPriceCents, String currency, List<String> tags, String note,
            boolean isPublic) {
        this.businessId = businessId;
        this.name = name;
        this.quantity = quantity;
        this.unitPriceCents = unitPriceCents;
        this.currency = currency;
        this.originalPrice = BigDecimal.valueOf(unitPriceCents, 2);
        this.originalCurrency = currency;
        this.tags = new ArrayList<>(tags);
        this.note = note;
        this.isPublic = isPublic;
    }

    public Integer getId() {
        return id;
    }

    public Integer getBusinessId() {
        return businessId;
    }

    public String getName() {
        return name;
    }

    public int getQuantity() {
        return quantity;
    }

    public int getUnitPriceCents() {
        return unitPriceCents;
    }

    public String getCurrency() {
        return currency;
    }

    public BigDecimal getOriginalPrice() {
        return originalPrice;
    }

    public String getOriginalCurrency() {
        return originalCurrency;
    }

    public BigDecimal getWidth() {
        return width;
    }

    public BigDecimal getHeight() {
        return height;
    }

    public String getSizeUnit() {
        return sizeUnit;
    }

    public int getAmountSold() {
        return amountSold;
    }

    public boolean isActive() {
        return isActive;
    }

    public List<String> getTags() {
        return tags;
    }

    public String getNote() {
        return note;
    }

    public boolean isPublic() {
        return isPublic;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    void setName(String name) {
        this.name = name;
    }

    /** Sets stock directly (PATCH). Sales and expenses use {@link #adjustQuantity} instead. */
    void setQuantity(int quantity) {
        this.quantity = quantity;
    }

    void setUnitPriceCents(int unitPriceCents) {
        this.unitPriceCents = unitPriceCents;
        this.originalPrice = BigDecimal.valueOf(unitPriceCents, 2);
        this.originalCurrency = currency;
    }

    public void convertPrice(int convertedPriceCents, String targetCurrency) {
        this.originalPrice = BigDecimal.valueOf(unitPriceCents, 2);
        this.originalCurrency = currency;
        this.unitPriceCents = convertedPriceCents;
        this.currency = targetCurrency;
    }

    public void relabelCurrency(String targetCurrency) {
        this.currency = targetCurrency;
        this.originalPrice = BigDecimal.valueOf(unitPriceCents, 2);
        this.originalCurrency = targetCurrency;
    }

    void setSize(BigDecimal width, BigDecimal height, String sizeUnit) {
        this.width = width;
        this.height = height;
        this.sizeUnit = sizeUnit;
    }

    void setAmountSold(int amountSold) {
        this.amountSold = amountSold;
    }

    void setActive(boolean isActive) {
        this.isActive = isActive;
    }

    /** Sets the item's own currency; the price is in this currency as entered, not converted. */
    void setCurrency(String currency) {
        this.currency = currency;
        this.originalCurrency = currency;
        this.originalPrice = BigDecimal.valueOf(unitPriceCents, 2);
    }

    /** Moves the sold count by {@code delta}, never below zero. */
    public void adjustAmountSold(int delta) {
        amountSold = Math.max(0, Math.addExact(amountSold, delta));
    }

    void setTags(List<String> tags) {
        this.tags = new ArrayList<>(tags);
    }

    void setNote(String note) {
        this.note = note;
    }

    void setPublic(boolean isPublic) {
        this.isPublic = isPublic;
    }

    /** Changes stock by {@code delta} (negative when selling). Callers check stock first. */
    public void adjustQuantity(int delta) {
        quantity = Math.addExact(quantity, delta);
    }
}
