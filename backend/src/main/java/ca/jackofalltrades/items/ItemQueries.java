package ca.jackofalltrades.items;

import ca.jackofalltrades.common.api.LikePatterns;
import ca.jackofalltrades.common.api.Paginated;
import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * The items list, insights and low-stock in plain SQL: search matches tags (a Postgres array),
 * which JPA queries can't express. Ported from the demo's items.repository.ts.
 */
@Component
public class ItemQueries {

    /** Whitelisted ORDER BY columns; the raw `sort` parameter never reaches the SQL. */
    static final Map<String, String> SORT_COLUMNS = Map.of(
            "id", "id",
            "name", "name",
            "quantity", "quantity",
            "unitPriceCents", "unit_price_cents");

    private static final RowMapper<ItemResponse> ROW_MAPPER = ItemQueries::mapRow;

    private final JdbcClient jdbcClient;

    public ItemQueries(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    /**
     * @param search already trimmed; null for no search
     * @param sort   a key of {@link #SORT_COLUMNS}
     * @param order  "asc" or "desc"
     */
    public Paginated<ItemResponse> findPage(
            int businessId, String search, String sort, String order, int page, int pageSize) {
        Map<String, Object> params = new HashMap<>();
        params.put("businessId", businessId);
        String where = "WHERE business_id = :businessId";
        if (search != null) {
            params.put("pattern", LikePatterns.contains(search));
            where += " AND (name ILIKE :pattern OR array_to_string(tags, ' ') ILIKE :pattern)";
        }

        long total = jdbcClient.sql("SELECT COUNT(*) FROM items " + where)
                .params(params)
                .query(Long.class)
                .single();

        String direction = "desc".equals(order) ? "DESC" : "ASC";
        params.put("limit", pageSize);
        params.put("offset", (page - 1) * pageSize);
        List<ItemResponse> data = jdbcClient.sql("SELECT * FROM items " + where
                        + " ORDER BY " + SORT_COLUMNS.get(sort) + " " + direction + ", id ASC"
                        + " LIMIT :limit OFFSET :offset")
                .params(params)
                .query(ROW_MAPPER)
                .list();

        return Paginated.of(data, page, pageSize, total);
    }

    /** Stock value at selling price and total units, as {@code [valueCents, units]}. */
    public long[] stockTotals(int businessId) {
        return jdbcClient.sql("""
                        SELECT COALESCE(SUM(quantity::bigint * unit_price_cents), 0),
                               COALESCE(SUM(quantity::bigint), 0)
                        FROM items WHERE business_id = :businessId
                        """)
                .param("businessId", businessId)
                .query((rs, rowNum) -> new long[] {rs.getLong(1), rs.getLong(2)})
                .single();
    }

    /**
     * The {@code limit} items with the most units sold in {@code [from, to)}, most first, from the
     * demo's bestSellers. Only lines still linked to an item count: a deleted item has no place here.
     */
    public List<InventoryInsights.BestSeller> bestSellers(int businessId, Instant from, Instant to, int limit) {
        return jdbcClient.sql("""
                        SELECT i.id, i.name, SUM(si.quantity::bigint) AS units_sold,
                               SUM(si.total_cents::bigint) AS revenue_cents
                        FROM sale_items si
                        JOIN sales s ON s.id = si.sale_id
                        JOIN items i ON i.id = si.item_id
                        WHERE s.business_id = :businessId AND s.sold_at >= :from AND s.sold_at < :to
                        GROUP BY i.id, i.name
                        ORDER BY units_sold DESC, revenue_cents DESC, i.name ASC
                        LIMIT :limit
                        """)
                .param("businessId", businessId)
                .param("from", OffsetDateTime.ofInstant(from, ZoneOffset.UTC))
                .param("to", OffsetDateTime.ofInstant(to, ZoneOffset.UTC))
                .param("limit", limit)
                .query((rs, rowNum) -> new InventoryInsights.BestSeller(
                        rs.getInt("id"), rs.getString("name"), rs.getLong("units_sold"), rs.getLong("revenue_cents")))
                .list();
    }

    /** How many items have at most {@code threshold} left, plus the {@code limit} lowest, lowest first. */
    public LowStock lowStock(int businessId, int threshold, int limit) {
        Map<String, Object> params = Map.of("businessId", businessId, "threshold", threshold, "limit", limit);
        long count = jdbcClient.sql("SELECT COUNT(*) FROM items WHERE business_id = :businessId AND quantity <= :threshold")
                .params(params)
                .query(Long.class)
                .single();
        List<LowStock.LowItem> items = jdbcClient.sql("""
                        SELECT id, name, quantity FROM items
                        WHERE business_id = :businessId AND quantity <= :threshold
                        ORDER BY quantity ASC, name ASC, id ASC
                        LIMIT :limit
                        """)
                .params(params)
                .query((rs, rowNum) -> new LowStock.LowItem(rs.getInt("id"), rs.getString("name"), rs.getInt("quantity")))
                .list();
        return new LowStock(count, threshold, items);
    }

    private static ItemResponse mapRow(ResultSet rs, int rowNum) throws SQLException {
        Array tags = rs.getArray("tags");
        return new ItemResponse(
                rs.getInt("id"),
                rs.getString("name"),
                rs.getInt("quantity"),
                rs.getInt("unit_price_cents"),
                List.of((String[]) tags.getArray()),
                rs.getString("note"),
                rs.getObject("created_at", OffsetDateTime.class).toInstant(),
                rs.getObject("updated_at", OffsetDateTime.class).toInstant());
    }
}
