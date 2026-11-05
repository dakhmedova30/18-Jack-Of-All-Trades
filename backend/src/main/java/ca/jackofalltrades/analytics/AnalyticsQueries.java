package ca.jackofalltrades.analytics;

import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Read-only queries over sales, expenses and items, ported from the demo's analytics.repository.ts.
 * They return raw tagged lines; bucketing and the "top N + Other" folding happen in AnalyticsService.
 */
@Component
public class AnalyticsQueries {

    /** One sale or expense line: its parent's date, its parent's first tag ("Untagged" if none), its total. */
    record TaggedLine(Instant at, String tag, String currency, long totalCents) {}

    record TagStock(String tag, long quantity, long itemCount) {}

    /** One channel's revenue in one currency (sales keep the currency they were recorded in). */
    record ChannelLine(String channel, String currency, long totalCents) {}

    /** The first and last day (UTC) with a sale or expense; both null when there are none. */
    record RecordSpan(LocalDate first, LocalDate last) {}

    private final JdbcClient jdbcClient;

    public AnalyticsQueries(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    /**
     * Every sale line of this business sold at or after {@code since} and before {@code until};
     * a null {@code until} means no upper bound, as the demo's ranges. A null {@code channelId}
     * means every channel.
     */
    List<TaggedLine> revenueLines(int businessId, Instant since, Instant until, Integer channelId) {
        SalesWhere where = new SalesWhere(businessId, since, until, channelId);
        return taggedLines("""
                SELECT s.sold_at AS at, COALESCE(s.tags[1], 'Untagged') AS tag, s.currency, si.total_cents
                FROM sales s JOIN sale_items si ON si.sale_id = s.id
                """ + where.sql(), where.params());
    }

    /** As {@link #revenueLines}, for expense lines by when they were incurred. Expenses have no channel. */
    List<TaggedLine> expenseLines(int businessId, Instant since, Instant until) {
        String sql = """
                SELECT e.incurred_at AS at, COALESCE(e.tags[1], 'Untagged') AS tag, e.currency, ei.total_cents
                FROM expenses e JOIN expense_items ei ON ei.expense_id = e.id
                WHERE e.business_id = :businessId AND e.incurred_at >= :since
                """;
        Map<String, Object> params = new HashMap<>();
        params.put("businessId", businessId);
        params.put("since", utc(since));
        if (until != null) {
            sql += "AND e.incurred_at < :until\n";
            params.put("until", utc(until));
        }
        return taggedLines(sql, params);
    }

    /**
     * Revenue per channel and currency over the same lines as {@link #revenueLines}. Sales keep
     * the currency they were recorded in, so AnalyticsService converts each subtotal to the
     * account's currency before adding them up and sorting.
     */
    List<ChannelLine> revenueByChannel(int businessId, Instant since, Instant until, Integer channelId) {
        SalesWhere where = new SalesWhere(businessId, since, until, channelId);
        return jdbcClient.sql("""
                        SELECT c.name AS channel, s.currency, SUM(si.total_cents) AS total_cents
                        FROM sales s JOIN sale_items si ON si.sale_id = s.id JOIN channels c ON c.id = s.channel_id
                        """ + where.sql() + """
                        GROUP BY c.id, c.name, s.currency
                        """)
                .params(where.params())
                .query((rs, rowNum) -> new ChannelLine(
                        rs.getString("channel"), rs.getString("currency"), rs.getLong("total_cents")))
                .list();
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

    /**
     * The filter shared by the revenue queries: one business's sales from {@code since}, before
     * {@code until} unless it's null, and in one channel unless {@code channelId} is null.
     * Every value is a bound parameter; only these fixed fragments are added to the SQL.
     */
    private record SalesWhere(int businessId, Instant since, Instant until, Integer channelId) {

        String sql() {
            return "WHERE s.business_id = :businessId AND s.sold_at >= :since\n"
                    + (until == null ? "" : "AND s.sold_at < :until\n")
                    + (channelId == null ? "" : "AND s.channel_id = :channelId\n");
        }

        Map<String, Object> params() {
            Map<String, Object> params = new HashMap<>();
            params.put("businessId", businessId);
            params.put("since", utc(since));
            if (until != null) {
                params.put("until", utc(until));
            }
            if (channelId != null) {
                params.put("channelId", channelId);
            }
            return params;
        }
    }

    private List<TaggedLine> taggedLines(String sql, Map<String, Object> params) {
        return jdbcClient.sql(sql)
                .params(params)
                .query((rs, rowNum) -> new TaggedLine(
                        rs.getObject("at", OffsetDateTime.class).toInstant(),
                        rs.getString("tag"),
                        rs.getString("currency"),
                        rs.getLong("total_cents")))
                .list();
    }

    private static OffsetDateTime utc(Instant at) {
        return OffsetDateTime.ofInstant(at, ZoneOffset.UTC);
    }

    private static LocalDate utcDay(OffsetDateTime at) {
        return at == null ? null : LocalDate.ofInstant(at.toInstant(), ZoneOffset.UTC);
    }
}
