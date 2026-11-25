package ca.jackofalltrades.expenses;

import ca.jackofalltrades.common.api.LikePatterns;
import ca.jackofalltrades.common.api.Paginated;
import ca.jackofalltrades.currency.CurrencyTotals;
import java.math.BigDecimal;
import java.util.Comparator;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
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
    private final CurrencyTotals currencyTotals;

    public ExpenseQueries(JdbcClient jdbcClient, CurrencyTotals currencyTotals) {
        this.jdbcClient = jdbcClient;
        this.currencyTotals = currencyTotals;
    }

    /**
     * @param search already trimmed; null for no search
     * @param sort   a key of {@link #SORT_EXPRESSIONS}
     * @param order  "asc" or "desc"
     */
    public Paginated<ExpenseResponse> findPage(
            int businessId, String search, String sort, String order, int page, int pageSize,
            String category, String subcategory, String manufacturer, String type, LocalDate from, LocalDate to) {
        Map<String, Object> params = new HashMap<>();
        params.put("businessId", businessId);
        String where = "WHERE e.business_id = :businessId";
        if (search != null) {
            params.put("pattern", LikePatterns.contains(search));
            where += SEARCH;
        }
        if (from != null) {
            params.put("from", from.atStartOfDay().atOffset(ZoneOffset.UTC));
            where += " AND e.incurred_at >= :from";
        }
        if (to != null) {
            params.put("to", to.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC));
            where += " AND e.incurred_at < :to";
        }
        StringBuilder lineWhere = new StringBuilder();
        addLineFilter(lineWhere, params, "category", category);
        addLineFilter(lineWhere, params, "subcategory", subcategory);
        addLineFilter(lineWhere, params, "manufacturer", manufacturer);
        addLineFilter(lineWhere, params, "line_type", type);
        if (!lineWhere.isEmpty()) {
            where += " AND EXISTS (SELECT 1 FROM expense_items ei WHERE ei.expense_id = e.id" + lineWhere + ")";
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
                        lines.getOrDefault(row.id(), List.of()), row.createdAt(), row.updatedAt(), row.currency(),
                        row.originalAmount(), row.originalCurrency()))
                .toList();
        return Paginated.of(data, page, pageSize, total);
    }

    private static void addLineFilter(StringBuilder where, Map<String, Object> params,
            String column, String value) {
        if (value == null) return;
        where.append(" AND ei.").append(column).append(" = :").append(column);
        params.put(column, value);
    }

    /**
     * Spending in {@code [from, to)}, from merge-ui-mods' spendingByKind and topRestockItems. A
     * restock line whose item was later deleted loses its item link, so it counts as a running cost.
     */
    public ExpenseMonthBreakdown periodBreakdown(
            int businessId, Instant from, Instant to, int topLimit, String targetCurrency) {
        Map<String, Object> params = Map.of(
                "businessId", businessId,
                "from", OffsetDateTime.ofInstant(from, ZoneOffset.UTC),
                "to", OffsetDateTime.ofInstant(to, ZoneOffset.UTC));

        Map<String, long[]> byCurrency = jdbcClient.sql("""
                        SELECT e.currency,
                               COALESCE(SUM(ei.total_cents) FILTER (WHERE ei.item_id IS NOT NULL), 0) AS restock_cents,
                               COALESCE(SUM(ei.total_cents) FILTER (WHERE ei.item_id IS NULL), 0) AS running_cents
                        FROM expenses e JOIN expense_items ei ON ei.expense_id = e.id
                        WHERE e.business_id = :businessId AND e.incurred_at >= :from AND e.incurred_at < :to
                        GROUP BY e.currency
                        """)
                .params(params)
                .query((rs, rowNum) -> Map.entry(
                        rs.getString("currency"),
                        new long[] {rs.getLong("restock_cents"), rs.getLong("running_cents")}))
                .list().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
        List<RawTopRestockItem> rawTop = jdbcClient.sql("""
                        SELECT i.id, i.name, e.currency, SUM(ei.quantity) AS units, SUM(ei.total_cents) AS spent_cents
                        FROM expense_items ei
                        JOIN expenses e ON e.id = ei.expense_id
                        JOIN items i ON i.id = ei.item_id
                        WHERE e.business_id = :businessId AND e.incurred_at >= :from AND e.incurred_at < :to
                        GROUP BY i.id, i.name, e.currency
                        """)
                .params(params)
                .query((rs, rowNum) -> new RawTopRestockItem(
                        rs.getInt("id"),
                        rs.getString("name"),
                        rs.getString("currency"),
                        rs.getLong("units"),
                        rs.getLong("spent_cents")))
                .list();

        Map<String, Long> restockByCurrency = new HashMap<>();
        Map<String, Long> runningByCurrency = new HashMap<>();
        byCurrency.forEach((currency, totals) -> {
            restockByCurrency.put(currency, totals[0]);
            runningByCurrency.put(currency, totals[1]);
        });
        long restock = currencyTotals.convertSubtotals(restockByCurrency, targetCurrency);
        long running = currencyTotals.convertSubtotals(runningByCurrency, targetCurrency);
        Map<Integer, List<RawTopRestockItem>> groupedTop = rawTop.stream()
                .collect(Collectors.groupingBy(RawTopRestockItem::id));
        List<ExpenseMonthBreakdown.TopRestockItem> top = groupedTop.values().stream()
                .map(rows -> {
                    RawTopRestockItem first = rows.get(0);
                    Map<String, Long> byItemCurrency = rows.stream().collect(Collectors.toMap(
                            RawTopRestockItem::currency, RawTopRestockItem::spentCents, Long::sum));
                    long spent = currencyTotals.convertSubtotals(byItemCurrency, targetCurrency);
                    long units = rows.stream().mapToLong(RawTopRestockItem::units).sum();
                    return new ExpenseMonthBreakdown.TopRestockItem(first.id(), first.name(), units, spent);
                })
                .sorted(Comparator.comparingLong(ExpenseMonthBreakdown.TopRestockItem::spentCents)
                        .reversed()
                        .thenComparing(ExpenseMonthBreakdown.TopRestockItem::name))
                .limit(topLimit)
                .toList();
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
                        rs.getInt("total_cents"),
                        rs.getString("category"),
                        rs.getString("subcategory"),
                        rs.getString("manufacturer"),
                        rs.getString("line_type"))))
                .list().stream()
                .collect(Collectors.groupingBy(Map.Entry::getKey,
                        Collectors.mapping(Map.Entry::getValue, Collectors.toList())));
    }

    /** All classified lines in the business, preserving their source transaction IDs. */
    public List<ExpenseLineReportResponse> findLineReport(int businessId) {
        return jdbcClient.sql("""
                        SELECT ei.id AS line_id, e.id AS expense_id, e.incurred_at, e.description AS expense_description,
                               e.currency, e.original_currency, ei.item_name, ei.quantity, ei.unit_cost_cents,
                               ei.total_cents, ei.category, ei.subcategory, ei.manufacturer, ei.line_type
                        FROM expense_items ei
                        JOIN expenses e ON e.id = ei.expense_id
                        WHERE e.business_id = :businessId
                        ORDER BY e.incurred_at DESC, e.id DESC, ei.id
                        """)
                .param("businessId", businessId)
                .query((rs, rowNum) -> new ExpenseLineReportResponse(
                        rs.getInt("line_id"),
                        rs.getInt("expense_id"),
                        rs.getObject("incurred_at", OffsetDateTime.class).toInstant(),
                        rs.getString("expense_description"),
                        rs.getString("currency"),
                        rs.getString("original_currency"),
                        rs.getString("item_name"),
                        rs.getInt("quantity"),
                        rs.getInt("unit_cost_cents"),
                        rs.getLong("total_cents"),
                        rs.getLong("total_cents"),
                        rs.getString("category"),
                        rs.getString("subcategory"),
                        rs.getString("manufacturer"),
                        rs.getString("line_type")))
                .list();
    }

    private record ExpenseRow(Integer id, Instant incurredAt, String description, List<String> tags,
            Instant createdAt, Instant updatedAt, String currency, BigDecimal originalAmount, String originalCurrency) {}

    private record RawTopRestockItem(Integer id, String name, String currency, long units, long spentCents) {}

    private static ExpenseRow mapExpense(ResultSet rs, int rowNum) throws SQLException {
        return new ExpenseRow(
                rs.getInt("id"),
                rs.getObject("incurred_at", OffsetDateTime.class).toInstant(),
                rs.getString("description"),
                List.of((String[]) rs.getArray("tags").getArray()),
                rs.getObject("created_at", OffsetDateTime.class).toInstant(),
                rs.getObject("updated_at", OffsetDateTime.class).toInstant(),
                rs.getString("currency"),
                rs.getBigDecimal("original_amount"),
                rs.getString("original_currency"));
    }
}
