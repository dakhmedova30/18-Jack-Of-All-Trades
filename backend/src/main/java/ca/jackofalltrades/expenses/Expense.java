package ca.jackofalltrades.expenses;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** A supplier order or a bill (contract §5). Its total isn't stored: it's the sum of its lines. */
@Entity
@Table(name = "expenses")
public class Expense {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, updatable = false)
    private Integer businessId;

    @Column(nullable = false)
    private Instant incurredAt;

    @Column(nullable = false)
    private String description;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(nullable = false)
    private List<String> tags;

    @OneToMany(mappedBy = "expense", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id")
    private List<ExpenseLine> lines = new ArrayList<>();

    // Set in replace() rather than by @UpdateTimestamp, which skips edits that only change lines.
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    protected Expense() {
        // for JPA
    }

    Expense(Integer businessId) {
        this.businessId = businessId;
    }

    /** Sets every field and replaces all lines; used for both create and PATCH (which replaces the expense). */
    void replace(Instant incurredAt, String description, List<String> tags, List<ExpenseLine> newLines) {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS); // Postgres keeps microseconds
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
        this.incurredAt = incurredAt;
        this.description = description;
        this.tags = new ArrayList<>(tags);
        lines.clear();
        for (ExpenseLine line : newLines) {
            line.setExpense(this);
            lines.add(line);
        }
    }

    public Integer getId() {
        return id;
    }

    public Integer getBusinessId() {
        return businessId;
    }

    public Instant getIncurredAt() {
        return incurredAt;
    }

    public String getDescription() {
        return description;
    }

    public List<String> getTags() {
        return tags;
    }

    public List<ExpenseLine> getLines() {
        return lines;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
