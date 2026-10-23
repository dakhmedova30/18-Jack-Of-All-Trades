package ca.jackofalltrades.expenses;

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
 * The expenses list and month breakdown in plain SQL, ported from the demo's
 * expenses.repository.ts (implement-user-login): search spans tags, description and line names,
 * and sorting by total needs a subquery; neither is easy in JPA.
 */
@Component
public class ExpenseQueries {

    /** Whitelisted ORDER BY expressions; the raw `sort` parameter never reaches the SQL. */
    static final Map<String, String> SORT_EXPRESSIONS = Map.of(
            "id", "e.id",
            "incurredAt", "e.incurred_at",
            "total", "(SELECT COALESCE(SUM(ei.total_cents), 0) FROM expense_items ei WHERE ei.expense_id = e.id)",
            "tags", "lower(e.tags[1])");

    private static final String SEARCH = " AND (array_to_string(e.tags, ' ') ILIKE :pattern"
            + " OR e.description ILIKE :pattern"
            + " OR EXISTS (SELECT 1 FROM expense_items ei WHERE ei.expense_id = e.id AND ei.item_name ILIKE :pattern))";

    private final JdbcClient jdbcClient;

    public ExpenseQueries(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    /**
     * @param search already trimmed; null for no search
     * @param sort   a key of {@link #SORT_EXPRESSIONS}
     * @param order  "asc" or "desc"
     */
    public Paginated<ExpenseResponse> findPage(
            int businessId, String search, String sort, String order, int page, int pageSize) {
        Map<String, Object> params = new HashMap<>();
        params.put("businessId", businessId);
        String where = "WHERE e.business_id = :businessId";
        if (search != null) {
            params.put("pattern", LikePatterns.contains(search));
            where += SEARCH;
        }

        long total = jdbcClient.sql("SELECT COUNT(*) FROM expenses e " + where)
                .params(params)
                .query(Long.class)
                .single();

        // Untagged expenses sort last either way; id breaks ties (newest first, as the demo) so paging is stable.
        String direction = "desc".equals(order) ? "DESC" : "ASC";
        params.put("limit", pageSize);
        params.put("offset", (page - 1) * pageSize);
        List<ExpenseRow> rows = jdbcClient.sql("SELECT e.* FROM expenses e " + where
                        + " ORDER BY " + SORT_EXPRESSIONS.get(sort) + " " + direction + " NULLS LAST, e.id DESC"
                        + " LIMIT :limit OFFSET :offset")
                .params(params)
                .query(ExpenseQueries::mapExpense)
                .list();

        Map<Integer, List<ExpenseLineResponse>> lines = linesByExpense(rows.stream().map(ExpenseRow::id).toList());
        List<ExpenseResponse> data = rows.stream()
                .map(row -> ExpenseResponse.of(row.id(), row.incurredAt(), row.description(), row.tags(),
                        lines.getOrDefault(row.id(), List.of()), row.createdAt(), row.updatedAt()))
                .toList();
        return Paginated.of(data, page, pageSize, total);
    }

    /**
     * Spending in {@code [from, to)}, from merge-ui-mods' spendingByKind and topRestockItems. A
     * restock line whose item was later deleted loses its item link, so it counts as a running cost.
     */
    public ExpenseMonthBreakdown periodBreakdown(int businessId, Instant from, Instant to, int topLimit) {
        Map<String, Object> params = Map.of(
                "businessId", businessId,
                "from", OffsetDateTime.ofInstant(from, ZoneOffset.UTC),
                "to", OffsetDateTime.ofInstant(to, ZoneOffset.UTC),
                "limit", topLimit);

        long[] byKind = jdbcClient.sql("""
                        SELECT COALESCE(SUM(ei.total_cents) FILTER (WHERE ei.item_id IS NOT NULL), 0),
                               COALESCE(SUM(ei.total_cents) FILTER (WHERE ei.item_id IS NULL), 0)
                        FROM expenses e JOIN expense_items ei ON ei.expense_id = e.id
                        WHERE e.business_id = :businessId AND e.incurred_at >= :from AND e.incurred_at < :to
                        """)
                .params(params)
                .query((rs, rowNum) -> new long[] {rs.getLong(1), rs.getLong(2)})
                .single();
        List<ExpenseMonthBreakdown.TopRestockItem> top = jdbcClient.sql("""
                        SELECT i.id, i.name, SUM(ei.quantity) AS units, SUM(ei.total_cents) AS spent_cents
                        FROM expense_items ei
                        JOIN expenses e ON e.id = ei.expense_id
                        JOIN items i ON i.id = ei.item_id
                        WHERE e.business_id = :businessId AND e.incurred_at >= :from AND e.incurred_at < :to
                        GROUP BY i.id, i.name
                        ORDER BY spent_cents DESC, i.name ASC
                        LIMIT :limit
                        """)
                .params(params)
                .query((rs, rowNum) -> new ExpenseMonthBreakdown.TopRestockItem(
                        rs.getInt("id"), rs.getString("name"), rs.getLong("units"), rs.getLong("spent_cents")))
                .list();

        long restock = byKind[0];
        long running = byKind[1];
        return new ExpenseMonthBreakdown(from, to, restock, running, restock + running, top);
    }

    /** All the page's lines in one query, grouped by expense, each expense's lines in id order. */
    private Map<Integer, List<ExpenseLineResponse>> linesByExpense(List<Integer> expenseIds) {
        if (expenseIds.isEmpty()) {
            return Map.of();
        }
        return jdbcClient.sql("SELECT * FROM expense_items WHERE expense_id IN (:expenseIds) ORDER BY id")
                .param("expenseIds", expenseIds)
                .query((rs, rowNum) -> Map.entry(rs.getInt("expense_id"), new ExpenseLineResponse(
                        rs.getInt("id"),
                        rs.getObject("item_id", Integer.class),
                        rs.getString("item_name"),
                        rs.getInt("quantity"),
                        rs.getInt("unit_cost_cents"),
                        rs.getInt("total_cents"))))
                .list().stream()
                .collect(Collectors.groupingBy(Map.Entry::getKey,
                        Collectors.mapping(Map.Entry::getValue, Collectors.toList())));
    }

    private record ExpenseRow(Integer id, Instant incurredAt, String description, List<String> tags,
            Instant createdAt, Instant updatedAt) {}

    private static ExpenseRow mapExpense(ResultSet rs, int rowNum) throws SQLException {
        return new ExpenseRow(
                rs.getInt("id"),
                rs.getObject("incurred_at", OffsetDateTime.class).toInstant(),
                rs.getString("description"),
                List.of((String[]) rs.getArray("tags").getArray()),
                rs.getObject("created_at", OffsetDateTime.class).toInstant(),
                rs.getObject("updated_at", OffsetDateTime.class).toInstant());
    }
}
