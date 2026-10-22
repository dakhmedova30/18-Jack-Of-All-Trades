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
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
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

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "channel_id", nullable = false)
    private Channel channel;

    @Column(nullable = false)
    private String description;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(nullable = false)
    private List<String> tags;

    @OneToMany(mappedBy = "sale", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id")
    private List<SaleLine> lines = new ArrayList<>();

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;

    protected Sale() {
        // for JPA
    }

    Sale(Integer businessId) {
        this.businessId = businessId;
    }

    /** Sets every field and replaces all lines; used for both create and PATCH (which replaces the sale). */
    void replace(Instant soldAt, Channel channel, String description, List<String> tags, List<SaleLine> newLines) {
        this.soldAt = soldAt;
        this.channel = channel;
        this.description = description;
        this.tags = new ArrayList<>(tags);
        lines.clear();
        for (SaleLine line : newLines) {
            line.setSale(this);
            lines.add(line);
        }
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
