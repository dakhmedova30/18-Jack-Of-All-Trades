package ca.jackofalltrades.items;

import ca.jackofalltrades.common.api.Paginated;
import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * The items list in plain SQL: search matches tags (a Postgres array), which JPA queries
 * can't express. Ported from the demo's items.repository.ts.
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
            params.put("pattern", "%" + escapeLikePattern(search) + "%");
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

    /** Escapes LIKE wildcards so a search for "%" or "_" matches those characters literally. */
    static String escapeLikePattern(String value) {
        return value.replaceAll("([\\\\%_])", "\\\\$1");
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
