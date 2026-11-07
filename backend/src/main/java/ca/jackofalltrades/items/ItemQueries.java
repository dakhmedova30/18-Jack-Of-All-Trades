package ca.jackofalltrades.items;

import ca.jackofalltrades.common.api.LikePatterns;
import ca.jackofalltrades.common.api.Paginated;
import ca.jackofalltrades.currency.CurrencyTotals;
import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Comparator;
import java.util.stream.Collectors;
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
    private final CurrencyTotals currencyTotals;

    public ItemQueries(JdbcClient jdbcClient, CurrencyTotals currencyTotals) {
        this.jdbcClient = jdbcClient;
        this.currencyTotals = currencyTotals;
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

    /** Stock value at selling price (converted to {@code targetCurrency}) and total units, as {@code [valueCents, units]}. */
    public long[] stockTotals(int businessId, String targetCurrency) {
        record Row(String currency, long valueCents, long units) {}
        List<Row> rows = jdbcClient.sql("""
                        SELECT currency, SUM(quantity::bigint * unit_price_cents) AS value_cents,
                               SUM(quantity::bigint) AS units
                        FROM items WHERE business_id = :businessId
                        GROUP BY currency
                        """)
                .param("businessId", businessId)
                .query((rs, rowNum) -> new Row(rs.getString(1), rs.getLong(2), rs.getLong(3)))
                .list();
        Map<String, Long> byCurrency = rows.stream()
                .collect(Collectors.toMap(Row::currency, Row::valueCents, Long::sum));
        long units = rows.stream().mapToLong(Row::units).sum();
        return new long[] {currencyTotals.convertSubtotals(byCurrency, targetCurrency), units};
    }

    /**
     * The {@code limit} items with the most units sold in {@code [from, to)}, most first, from the
     * demo's bestSellers. Only lines still linked to an item count: a deleted item has no place here.
     */
    public List<InventoryInsights.BestSeller> bestSellers(
            int businessId, Instant from, Instant to, int limit, String targetCurrency) {
        List<RawBestSeller> rows = jdbcClient.sql("""
                        SELECT i.id, i.name, s.currency, SUM(si.quantity::bigint) AS units_sold,
                               SUM(si.total_cents::bigint) AS revenue_cents
                        FROM sale_items si
                        JOIN sales s ON s.id = si.sale_id
                        JOIN items i ON i.id = si.item_id
                        WHERE s.business_id = :businessId AND s.sold_at >= :from AND s.sold_at < :to
                        GROUP BY i.id, i.name, s.currency
                        """)
                .param("businessId", businessId)
                .param("from", OffsetDateTime.ofInstant(from, ZoneOffset.UTC))
                .param("to", OffsetDateTime.ofInstant(to, ZoneOffset.UTC))
                .query((rs, rowNum) -> new RawBestSeller(
                        rs.getInt("id"),
                        rs.getString("name"),
                        rs.getString("currency"),
                        rs.getLong("units_sold"),
                        rs.getLong("revenue_cents")))
                .list();
        return rows.stream()
                .collect(Collectors.groupingBy(RawBestSeller::id))
                .values().stream()
                .map(itemRows -> {
                    RawBestSeller first = itemRows.getFirst();
                    Map<String, Long> totalsByCurrency = itemRows.stream().collect(Collectors.toMap(
                            RawBestSeller::currency, RawBestSeller::revenueCents, Long::sum));
                    long revenue = currencyTotals.convertSubtotals(totalsByCurrency, targetCurrency);
                    long units = itemRows.stream().mapToLong(RawBestSeller::unitsSold).sum();
                    return new InventoryInsights.BestSeller(first.id(), first.name(), units, revenue);
                })
                .sorted(Comparator.comparingLong(InventoryInsights.BestSeller::unitsSold).reversed()
                        .thenComparing(Comparator.comparingLong(InventoryInsights.BestSeller::revenueCents).reversed())
                        .thenComparing(InventoryInsights.BestSeller::name))
                .limit(limit)
                .toList();
    }

    /** In-stock items with no sale lines in {@code [from, to)}, by name. */
    public List<InventoryInsights.NotSellingItem> notSelling(int businessId, Instant from, Instant to) {
        return jdbcClient.sql("""
                        SELECT i.id, i.name, i.quantity
                        FROM items i
                        WHERE i.business_id = :businessId AND i.quantity > 0
                          AND NOT EXISTS (
                              SELECT 1
                              FROM sale_items si
                              JOIN sales s ON s.id = si.sale_id
                              WHERE si.item_id = i.id AND s.business_id = :businessId
                                AND s.sold_at >= :from AND s.sold_at < :to
                          )
                        ORDER BY i.name ASC, i.id ASC
                        """)
                .param("businessId", businessId)
                .param("from", OffsetDateTime.ofInstant(from, ZoneOffset.UTC))
                .param("to", OffsetDateTime.ofInstant(to, ZoneOffset.UTC))
                .query((rs, rowNum) -> new InventoryInsights.NotSellingItem(
                        rs.getInt("id"), rs.getString("name"), rs.getInt("quantity")))
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

    /** Names of those of {@code ids} that sales or expenses still point to. */
    public List<String> referencedNames(int businessId, java.util.Collection<Integer> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return jdbcClient.sql("""
                        SELECT i.name FROM items i
                        WHERE i.business_id = :businessId AND i.id IN (:ids)
                          AND (EXISTS (SELECT 1 FROM sale_items si WHERE si.item_id = i.id)
                               OR EXISTS (SELECT 1 FROM expense_items ei WHERE ei.item_id = i.id))
                        ORDER BY i.name
                        """)
                .param("businessId", businessId)
                .param("ids", ids)
                .query(String.class)
                .list();
    }

    private static ItemResponse mapRow(ResultSet rs, int rowNum) throws SQLException {
        Array tags = rs.getArray("tags");
        return new ItemResponse(
                rs.getInt("id"),
                rs.getString("name"),
                rs.getInt("quantity"),
                rs.getInt("unit_price_cents"),
                rs.getString("currency"),
                rs.getBigDecimal("original_price"),
                rs.getString("original_currency"),
                List.of((String[]) tags.getArray()),
                rs.getString("note"),
                rs.getBoolean("is_public"),
                rs.getBigDecimal("width"),
                rs.getBigDecimal("height"),
                rs.getString("size_unit"),
                rs.getInt("amount_sold"),
                rs.getBoolean("is_active"),
                rs.getObject("created_at", OffsetDateTime.class).toInstant(),
                rs.getObject("updated_at", OffsetDateTime.class).toInstant());
    }

    private record RawBestSeller(Integer id, String name, String currency, long unitsSold, long revenueCents) {}

    /** Every tag in use on this business's items with its item count: most used first, then A to Z. */
    public List<ItemTagCount> tagCounts(int businessId) {
        return jdbcClient.sql("""
                        SELECT tag AS name, COUNT(*) AS item_count
                        FROM items, unnest(tags) AS tag
                        WHERE business_id = :businessId
                        GROUP BY tag
                        ORDER BY COUNT(*) DESC, tag
                        """)
                .param("businessId", businessId)
                .query((rs, rowNum) -> new ItemTagCount(rs.getString("name"), rs.getLong("item_count")))
                .list();
    }

    /**
     * Renames a tag on every item that has it, returning how many items changed. An item that
     * already has the new name just loses the old one, so there are no repeats; order is kept.
     */
    public int renameTag(int businessId, String oldName, String newName) {
        return jdbcClient.sql("""
                        UPDATE items
                        SET tags = ARRAY(
                                SELECT t FROM (
                                    SELECT x AS t, MIN(pos) AS first_pos
                                    FROM unnest(array_replace(tags, :oldName, :newName)) WITH ORDINALITY AS u(x, pos)
                                    GROUP BY x) deduped
                                ORDER BY first_pos),
                            updated_at = now()
                        WHERE business_id = :businessId AND :oldName = ANY(tags)
                        """)
                .param("businessId", businessId)
                .param("oldName", oldName)
                .param("newName", newName)
                .update();
    }

    /** Removes a tag from every item that has it, returning how many items changed. */
    public int removeTag(int businessId, String name) {
        return jdbcClient.sql("""
                        UPDATE items SET tags = array_remove(tags, :name), updated_at = now()
                        WHERE business_id = :businessId AND :name = ANY(tags)
                        """)
                .param("businessId", businessId)
                .param("name", name)
                .update();
    }
}
