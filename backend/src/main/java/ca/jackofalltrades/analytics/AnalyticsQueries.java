package ca.jackofalltrades.analytics;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Read-only queries over sales, expenses and items, ported from the demo's analytics.repository.ts.
 * They return raw tagged lines; bucketing and the "top N + Other" folding happen in AnalyticsService.
 */
@Component
public class AnalyticsQueries {

    /** One sale or expense line: its parent's date, its parent's first tag ("Untagged" if none), its total. */
    record TaggedLine(Instant at, String tag, long totalCents) {}

    record TagStock(String tag, long quantity, long itemCount) {}

    private final JdbcClient jdbcClient;

    public AnalyticsQueries(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    /** Every sale line of this business sold at or after {@code since} (no upper bound, as the demo). */
    List<TaggedLine> revenueLines(int businessId, Instant since) {
        return taggedLines("""
                SELECT s.sold_at AS at, COALESCE(s.tags[1], 'Untagged') AS tag, si.total_cents
                FROM sales s JOIN sale_items si ON si.sale_id = s.id
                WHERE s.business_id = :businessId AND s.sold_at >= :since
                """, businessId, since);
    }

    /** Every expense line of this business incurred at or after {@code since} (no upper bound, as the demo). */
    List<TaggedLine> expenseLines(int businessId, Instant since) {
        return taggedLines("""
                SELECT e.incurred_at AS at, COALESCE(e.tags[1], 'Untagged') AS tag, ei.total_cents
                FROM expenses e JOIN expense_items ei ON ei.expense_id = e.id
                WHERE e.business_id = :businessId AND e.incurred_at >= :since
                """, businessId, since);
    }

    /** Current stock by each item's first tag, largest first. A snapshot, so no dates. */
    List<TagStock> stockByTag(int businessId) {
        return jdbcClient.sql("""
                        SELECT COALESCE(tags[1], 'Untagged') AS tag, SUM(quantity) AS quantity, COUNT(*) AS item_count
                        FROM items
                        WHERE business_id = :businessId
                        GROUP BY 1
                        ORDER BY quantity DESC, tag ASC
                        """)
                .param("businessId", businessId)
                .query((rs, rowNum) -> new TagStock(rs.getString("tag"), rs.getLong("quantity"), rs.getLong("item_count")))
                .list();
    }

    private List<TaggedLine> taggedLines(String sql, int businessId, Instant since) {
        return jdbcClient.sql(sql)
                .param("businessId", businessId)
                .param("since", OffsetDateTime.ofInstant(since, ZoneOffset.UTC))
                .query((rs, rowNum) -> new TaggedLine(
                        rs.getObject("at", OffsetDateTime.class).toInstant(),
                        rs.getString("tag"),
                        rs.getLong("total_cents")))
                .list();
    }
}
