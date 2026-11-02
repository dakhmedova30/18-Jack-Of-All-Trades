package ca.jackofalltrades.analytics;

import java.time.Instant;
import java.time.LocalDate;
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

    /** The first and last day (UTC) with a sale or expense; both null when there are none. */
    record RecordSpan(LocalDate first, LocalDate last) {}

    private final JdbcClient jdbcClient;

    public AnalyticsQueries(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    /**
     * Every sale line of this business sold at or after {@code since} and before {@code until};
     * a null {@code until} means no upper bound, as the demo's ranges.
     */
    List<TaggedLine> revenueLines(int businessId, Instant since, Instant until) {
        return taggedLines("""
                SELECT s.sold_at AS at, COALESCE(s.tags[1], 'Untagged') AS tag, si.total_cents
                FROM sales s JOIN sale_items si ON si.sale_id = s.id
                WHERE s.business_id = :businessId AND s.sold_at >= :since
                """, "s.sold_at", businessId, since, until);
    }

    /** As {@link #revenueLines}, for expense lines by when they were incurred. */
    List<TaggedLine> expenseLines(int businessId, Instant since, Instant until) {
        return taggedLines("""
                SELECT e.incurred_at AS at, COALESCE(e.tags[1], 'Untagged') AS tag, ei.total_cents
                FROM expenses e JOIN expense_items ei ON ei.expense_id = e.id
                WHERE e.business_id = :businessId AND e.incurred_at >= :since
                """, "e.incurred_at", businessId, since, until);
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

    /** When this business's sales and expenses start and end, for the date filter's slider. */
    RecordSpan recordSpan(int businessId) {
        return jdbcClient.sql("""
                        SELECT MIN(at) AS first, MAX(at) AS last FROM (
                            SELECT sold_at AS at FROM sales WHERE business_id = :businessId
                            UNION ALL
                            SELECT incurred_at FROM expenses WHERE business_id = :businessId
                        ) AS records
                        """)
                .param("businessId", businessId)
                .query((rs, rowNum) -> new RecordSpan(
                        utcDay(rs.getObject("first", OffsetDateTime.class)),
                        utcDay(rs.getObject("last", OffsetDateTime.class))))
                .single();
    }

    private List<TaggedLine> taggedLines(String sql, String dateColumn, int businessId, Instant since, Instant until) {
        JdbcClient.StatementSpec statement = jdbcClient
                .sql(until == null ? sql : sql + "AND " + dateColumn + " < :until\n")
                .param("businessId", businessId)
                .param("since", OffsetDateTime.ofInstant(since, ZoneOffset.UTC));
        if (until != null) {
            statement = statement.param("until", OffsetDateTime.ofInstant(until, ZoneOffset.UTC));
        }
        return statement
                .query((rs, rowNum) -> new TaggedLine(
                        rs.getObject("at", OffsetDateTime.class).toInstant(),
                        rs.getString("tag"),
                        rs.getLong("total_cents")))
                .list();
    }

    private static LocalDate utcDay(OffsetDateTime at) {
        return at == null ? null : LocalDate.ofInstant(at.toInstant(), ZoneOffset.UTC);
    }
}
