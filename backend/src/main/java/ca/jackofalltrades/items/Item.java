package ca.jackofalltrades.items;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
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

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(nullable = false)
    private List<String> tags;

    @Column(nullable = false)
    private String note;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;

    protected Item() {
        // for JPA
    }

    Item(Integer businessId, String name, int quantity, int unitPriceCents, List<String> tags, String note) {
        this.businessId = businessId;
        this.name = name;
        this.quantity = quantity;
        this.unitPriceCents = unitPriceCents;
        this.tags = new ArrayList<>(tags);
        this.note = note;
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

    public List<String> getTags() {
        return tags;
    }

    public String getNote() {
        return note;
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
    }

    void setTags(List<String> tags) {
        this.tags = new ArrayList<>(tags);
    }

    void setNote(String note) {
        this.note = note;
    }

    /** Changes stock by {@code delta} (negative when selling). Callers check stock first. */
    public void adjustQuantity(int delta) {
        quantity = Math.addExact(quantity, delta);
    }
}
