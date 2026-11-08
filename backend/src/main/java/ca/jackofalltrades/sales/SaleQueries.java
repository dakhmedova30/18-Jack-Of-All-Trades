package ca.jackofalltrades.sales;

import ca.jackofalltrades.channels.ChannelResponse;
import ca.jackofalltrades.common.api.LikePatterns;
import ca.jackofalltrades.common.api.Paginated;
import ca.jackofalltrades.currency.CurrencyTotals;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Comparator;
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
    private final CurrencyTotals currencyTotals;

    public SaleQueries(JdbcClient jdbcClient, CurrencyTotals currencyTotals) {
        this.jdbcClient = jdbcClient;
        this.currencyTotals = currencyTotals;
    }

    /**
     * @param sort  a key of {@link #SORT_EXPRESSIONS}
     * @param order "asc" or "desc"
     */
    public Paginated<SaleResponse> findPage(
            int businessId, SaleFilters filters, String sort, String order, int page, int pageSize) {
        Map<String, Object> params = new HashMap<>();
        params.put("businessId", businessId);
        String where = "WHERE s.business_id = :businessId";
        if (filters.search() != null) {
            params.put("pattern", LikePatterns.contains(filters.search()));
            where += SEARCH;
        }
        if (filters.channelId() != null) {
            params.put("channelId", filters.channelId());
            where += " AND s.channel_id = :channelId";
        }
        if (filters.marketId() != null) {
            params.put("marketId", filters.marketId());
            where += " AND s.market_id = :marketId";
        }
        if (filters.commissionId() != null) {
            params.put("commissionId", filters.commissionId());
            where += " AND s.commission_id = :commissionId";
        }
        // Whole UTC days: from the start of `from` up to (not including) the day after `to`.
        if (filters.from() != null) {
            params.put("from", startOfUtcDay(filters.from()));
            where += " AND s.sold_at >= :from";
        }
        if (filters.to() != null) {
            params.put("to", startOfUtcDay(filters.to().plusDays(1)));
            where += " AND s.sold_at < :to";
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
                        lines.getOrDefault(row.id(), List.of()), row.createdAt(), row.updatedAt(), row.currency(),
                        row.originalAmount(), row.originalCurrency(), row.marketId(), row.commissionId()))
                .toList();
        return Paginated.of(data, page, pageSize, total);
    }

    /** Sale count, revenue and the largest sale for sales in {@code [from, to)}, from merge-ui-mods' periodSummary. */
    public SalesMonthSummary periodSummary(int businessId, Instant from, Instant to, String targetCurrency) {
        String perSale = """
                WITH per_sale AS (
                  SELECT s.id, s.sold_at, s.currency, COALESCE(SUM(si.total_cents), 0) AS total_cents
                  FROM sales s LEFT JOIN sale_items si ON si.sale_id = s.id
                  WHERE s.business_id = :businessId AND s.sold_at >= :from AND s.sold_at < :to
                  GROUP BY s.id, s.currency)
                """;
        Map<String, Object> params = Map.of(
                "businessId", businessId,
                "from", OffsetDateTime.ofInstant(from, ZoneOffset.UTC),
                "to", OffsetDateTime.ofInstant(to, ZoneOffset.UTC));

        long count = jdbcClient.sql(perSale + "SELECT COUNT(*) FROM per_sale")
                .params(params)
                .query(Long.class)
                .single();
        Map<String, Long> totalsByCurrency = jdbcClient.sql(perSale
                        + "SELECT currency, SUM(total_cents) AS total_cents FROM per_sale GROUP BY currency")
                .params(params)
                .query((rs, rowNum) -> Map.entry(rs.getString("currency"), rs.getLong("total_cents")))
                .list().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
        SalesMonthSummary.LargestSale largest = jdbcClient.sql(perSale + "SELECT * FROM per_sale")
                .params(params)
                .query((rs, rowNum) -> new SalesMonthSummary.LargestSale(
                        rs.getInt("id"),
                        rs.getObject("sold_at", OffsetDateTime.class).toInstant(),
                        currencyTotals.convertCents(
                                rs.getLong("total_cents"), rs.getString("currency"), targetCurrency)))
                .list().stream()
                .max(Comparator.comparingLong(SalesMonthSummary.LargestSale::totalCents)
                        .thenComparing(SalesMonthSummary.LargestSale::soldAt)
                        .thenComparing(SalesMonthSummary.LargestSale::id))
                .orElse(null);

        long revenue = currencyTotals.convertSubtotals(totalsByCurrency, targetCurrency);
        long average = count > 0
                ? BigDecimal.valueOf(revenue).divide(BigDecimal.valueOf(count), 0, java.math.RoundingMode.HALF_UP)
                        .longValueExact()
                : 0;
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
                        rs.getInt("total_cents"),
                        rs.getString("kind"),
                        rs.getBoolean("is_free"),
                        rs.getBoolean("is_trade"),
                        rs.getObject("discount_id", Integer.class))))
                .list().stream()
                .collect(Collectors.groupingBy(Map.Entry::getKey,
                        Collectors.mapping(Map.Entry::getValue, Collectors.toList())));
    }

    private static OffsetDateTime startOfUtcDay(LocalDate day) {
        return day.atStartOfDay().atOffset(ZoneOffset.UTC);
    }

    private record SaleRow(Integer id, Instant soldAt, ChannelResponse channel, String description,
            List<String> tags, Instant createdAt, Instant updatedAt, String currency, BigDecimal originalAmount,
            String originalCurrency, Integer marketId, Integer commissionId) {}

    private static SaleRow mapSale(ResultSet rs, int rowNum) throws SQLException {
        return new SaleRow(
                rs.getInt("id"),
                rs.getObject("sold_at", OffsetDateTime.class).toInstant(),
                new ChannelResponse(rs.getInt("channel_id"), rs.getString("channel_name")),
                rs.getString("description"),
                List.of((String[]) rs.getArray("tags").getArray()),
                rs.getObject("created_at", OffsetDateTime.class).toInstant(),
                rs.getObject("updated_at", OffsetDateTime.class).toInstant(),
                rs.getString("currency"),
                rs.getBigDecimal("original_amount"),
                rs.getString("original_currency"),
                rs.getObject("market_id", Integer.class),
                rs.getObject("commission_id", Integer.class));
    }
}
