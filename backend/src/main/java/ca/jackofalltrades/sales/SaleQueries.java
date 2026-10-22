package ca.jackofalltrades.sales;

import ca.jackofalltrades.channels.ChannelResponse;
import ca.jackofalltrades.common.api.LikePatterns;
import ca.jackofalltrades.common.api.Paginated;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * The sales list in plain SQL, ported from the demo's sales.repository.ts (implement-user-login):
 * search spans tags, description, channel name and line item names, and sorting by total needs
 * a subquery; neither is easy in JPA.
 */
@Component
public class SaleQueries {

    /** Whitelisted ORDER BY expressions; the raw `sort` parameter never reaches the SQL. */
    static final Map<String, String> SORT_EXPRESSIONS = Map.of(
            "id", "s.id",
            "soldAt", "s.sold_at",
            "total", "(SELECT COALESCE(SUM(si.total_cents), 0) FROM sale_items si WHERE si.sale_id = s.id)",
            "tags", "lower(s.tags[1])",
            "channel", "lower(c.name)");

    private static final String FROM = " FROM sales s JOIN channels c ON c.id = s.channel_id ";

    private static final String SEARCH = " AND (array_to_string(s.tags, ' ') ILIKE :pattern"
            + " OR s.description ILIKE :pattern"
            + " OR c.name ILIKE :pattern"
            + " OR EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.id AND si.item_name ILIKE :pattern))";

    private final JdbcClient jdbcClient;

    public SaleQueries(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    /**
     * @param search already trimmed; null for no search
     * @param sort   a key of {@link #SORT_EXPRESSIONS}
     * @param order  "asc" or "desc"
     */
    public Paginated<SaleResponse> findPage(
            int businessId, String search, String sort, String order, int page, int pageSize) {
        Map<String, Object> params = new HashMap<>();
        params.put("businessId", businessId);
        String where = "WHERE s.business_id = :businessId";
        if (search != null) {
            params.put("pattern", LikePatterns.contains(search));
            where += SEARCH;
        }

        long total = jdbcClient.sql("SELECT COUNT(*)" + FROM + where)
                .params(params)
                .query(Long.class)
                .single();

        // Untagged sales sort last either way; id breaks ties (newest first, as the demo) so paging is stable.
        String direction = "desc".equals(order) ? "DESC" : "ASC";
        params.put("limit", pageSize);
        params.put("offset", (page - 1) * pageSize);
        List<SaleRow> rows = jdbcClient.sql("SELECT s.*, c.name AS channel_name" + FROM + where
                        + " ORDER BY " + SORT_EXPRESSIONS.get(sort) + " " + direction + " NULLS LAST, s.id DESC"
                        + " LIMIT :limit OFFSET :offset")
                .params(params)
                .query(SaleQueries::mapSale)
                .list();

        Map<Integer, List<SaleLineResponse>> lines = linesBySale(rows.stream().map(SaleRow::id).toList());
        List<SaleResponse> data = rows.stream()
                .map(row -> SaleResponse.of(row.id(), row.soldAt(), row.channel(), row.description(), row.tags(),
                        lines.getOrDefault(row.id(), List.of()), row.createdAt(), row.updatedAt()))
                .toList();
        return Paginated.of(data, page, pageSize, total);
    }

    /** Sale count, revenue and the largest sale for sales in {@code [from, to)}, from merge-ui-mods' periodSummary. */
    public SalesMonthSummary periodSummary(int businessId, Instant from, Instant to) {
        String perSale = """
                WITH per_sale AS (
                  SELECT s.id, s.sold_at, COALESCE(SUM(si.total_cents), 0) AS total_cents
                  FROM sales s LEFT JOIN sale_items si ON si.sale_id = s.id
                  WHERE s.business_id = :businessId AND s.sold_at >= :from AND s.sold_at < :to
                  GROUP BY s.id)
                """;
        Map<String, Object> params = Map.of(
                "businessId", businessId,
                "from", OffsetDateTime.ofInstant(from, ZoneOffset.UTC),
                "to", OffsetDateTime.ofInstant(to, ZoneOffset.UTC));

        long[] totals = jdbcClient.sql(perSale + "SELECT COUNT(*), COALESCE(SUM(total_cents), 0) FROM per_sale")
                .params(params)
                .query((rs, rowNum) -> new long[] {rs.getLong(1), rs.getLong(2)})
                .single();
        SalesMonthSummary.LargestSale largest = jdbcClient.sql(perSale
                        + "SELECT * FROM per_sale ORDER BY total_cents DESC, sold_at DESC, id DESC LIMIT 1")
                .params(params)
                .query((rs, rowNum) -> new SalesMonthSummary.LargestSale(
                        rs.getInt("id"),
                        rs.getObject("sold_at", OffsetDateTime.class).toInstant(),
                        rs.getLong("total_cents")))
                .optional()
                .orElse(null);

        long count = totals[0];
        long revenue = totals[1];
        long average = count > 0 ? Math.round((double) revenue / count) : 0;
        return new SalesMonthSummary(from, to, count, revenue, average, largest);
    }

    /** All the page's lines in one query, grouped by sale, each sale's lines in id order. */
    private Map<Integer, List<SaleLineResponse>> linesBySale(List<Integer> saleIds) {
        if (saleIds.isEmpty()) {
            return Map.of();
        }
        return jdbcClient.sql("SELECT * FROM sale_items WHERE sale_id IN (:saleIds) ORDER BY id")
                .param("saleIds", saleIds)
                .query((rs, rowNum) -> Map.entry(rs.getInt("sale_id"), new SaleLineResponse(
                        rs.getInt("id"),
                        rs.getObject("item_id", Integer.class),
                        rs.getString("item_name"),
                        rs.getInt("quantity"),
                        rs.getInt("unit_price_cents"),
                        rs.getInt("total_cents"))))
                .list().stream()
                .collect(Collectors.groupingBy(Map.Entry::getKey,
                        Collectors.mapping(Map.Entry::getValue, Collectors.toList())));
    }

    private record SaleRow(Integer id, Instant soldAt, ChannelResponse channel, String description,
            List<String> tags, Instant createdAt, Instant updatedAt) {}

    private static SaleRow mapSale(ResultSet rs, int rowNum) throws SQLException {
        return new SaleRow(
                rs.getInt("id"),
                rs.getObject("sold_at", OffsetDateTime.class).toInstant(),
                new ChannelResponse(rs.getInt("channel_id"), rs.getString("channel_name")),
                rs.getString("description"),
                List.of((String[]) rs.getArray("tags").getArray()),
                rs.getObject("created_at", OffsetDateTime.class).toInstant(),
                rs.getObject("updated_at", OffsetDateTime.class).toInstant());
    }
}
