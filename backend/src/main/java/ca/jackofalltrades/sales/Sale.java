package ca.jackofalltrades.sales;

import ca.jackofalltrades.channels.Channel;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** One checkout (contract §4). Its total isn't stored: it's the sum of its lines. */
@Entity
@Table(name = "sales")
public class Sale {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, updatable = false)
    private Integer businessId;

    @Column(nullable = false)
    private Instant soldAt;

    @Column(nullable = false, length = 3)
    private String currency;

    @Column(nullable = false, precision = 16, scale = 2)
    private BigDecimal originalAmount;

    @Column(nullable = false, length = 3)
    private String originalCurrency;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "channel_id", nullable = false)
    private Channel channel;

    @Column(nullable = false)
    private String description;

    private Integer marketId;

    private Integer commissionId;

    private Integer miscId;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(nullable = false)
    private List<String> tags;

    @OneToMany(mappedBy = "sale", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id")
    private List<SaleLine> lines = new ArrayList<>();

    // Set in replace() rather than by @UpdateTimestamp, which skips edits that only change lines.
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    protected Sale() {
        // for JPA
    }

    Sale(Integer businessId) {
        this.businessId = businessId;
    }

    /**
     * Sets editable fields and replaces lines. Monetary metadata is initialized on creation and
     * reset if the sale's currency is changed (the new lines are priced in the new currency).
     */
    void replace(Instant soldAt, Channel channel, String description, List<String> tags, List<SaleLine> newLines,
            String currency, Integer marketId, Integer commissionId, Integer miscId) {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS); // Postgres keeps microseconds
        boolean creating = createdAt == null;
        boolean currencyChanged = !creating && !currency.equals(this.currency);
        if (creating) {
            createdAt = now;
        }
        if (creating || currencyChanged) {
            this.currency = currency;
            this.originalCurrency = currency;
        }
        updatedAt = now;
        this.soldAt = soldAt;
        this.channel = channel;
        this.description = description;
        this.marketId = marketId;
        this.commissionId = commissionId;
        this.miscId = miscId;
        this.tags = new ArrayList<>(tags);
        lines.clear();
        for (SaleLine line : newLines) {
            line.setSale(this);
            lines.add(line);
        }
        long totalCents = newLines.stream().mapToLong(SaleLine::getTotalCents).sum();
        if (creating || currencyChanged) {
            this.originalAmount = BigDecimal.valueOf(totalCents, 2);
        }
    }

    public Integer getMarketId() {
        return marketId;
    }

    public Integer getCommissionId() {
        return commissionId;
    }

    public Integer getMiscId() {
        return miscId;
    }

    public Integer getId() {
        return id;
    }

    public Integer getBusinessId() {
        return businessId;
    }

    public Instant getSoldAt() {
        return soldAt;
    }

    public String getCurrency() {
        return currency;
    }

    public BigDecimal getOriginalAmount() {
        return originalAmount;
    }

    public String getOriginalCurrency() {
        return originalCurrency;
    }

    public Channel getChannel() {
        return channel;
    }

    public String getDescription() {
        return description;
    }

    public List<String> getTags() {
        return tags;
    }

    public List<SaleLine> getLines() {
        return lines;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
