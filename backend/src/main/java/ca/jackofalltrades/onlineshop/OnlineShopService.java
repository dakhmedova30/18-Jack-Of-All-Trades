package ca.jackofalltrades.onlineshop;

import ca.jackofalltrades.common.api.BadRequestException;
import ca.jackofalltrades.common.api.NotFoundException;
import ca.jackofalltrades.common.security.CurrentBusiness;
import ca.jackofalltrades.currency.CurrencyTotals;
import ca.jackofalltrades.sales.SaleService;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The online shop. Its sales are ordinary sales on the "Online" channel (with no market), so they keep
 * their stock links; its months are not stored but grouped from those sales and the online expenses.
 */
@Service
public class OnlineShopService {

    private static final String ONLINE_SALES = """
            s.business_id = :b AND s.market_id IS NULL
            AND s.channel_id IN (SELECT id FROM channels WHERE business_id = :b AND lower(name) = 'online')
            """;

    private final JdbcClient jdbc;
    private final CurrentBusiness currentBusiness;
    private final CurrencyTotals currencyTotals;
    private final SaleService saleService;
    private final jakarta.persistence.EntityManager entityManager;

    public OnlineShopService(JdbcClient jdbc, CurrentBusiness currentBusiness, CurrencyTotals currencyTotals,
            SaleService saleService, jakarta.persistence.EntityManager entityManager) {
        this.jdbc = jdbc;
        this.currentBusiness = currentBusiness;
        this.currencyTotals = currencyTotals;
        this.saleService = saleService;
        this.entityManager = entityManager;
    }

    private record Acc(Map<String, Long> revenue, Map<String, Long> expenses, int sales) {}

    /** Newest month first, with every amount converted to {@code currency}. */
    @Transactional(readOnly = true)
    public List<OnlineMonthResponse> months(String currency) {
        record SaleRow(String month, String currency, long revenue, int sales) {}
        record ExpenseRow(String month, String currency, long total) {}
        List<SaleRow> saleRows = jdbc.sql("""
                        SELECT to_char(s.sold_at AT TIME ZONE 'UTC', 'YYYY-MM') AS month,
                               s.original_currency AS currency,
                               COALESCE(SUM(si.total_cents), 0) AS revenue,
                               COUNT(DISTINCT s.id) AS sales
                        FROM sales s LEFT JOIN sale_items si ON si.sale_id = s.id
                        WHERE""" + " " + ONLINE_SALES + """
                        GROUP BY 1, 2
                        """)
                .param("b", currentBusiness.id())
                .query((rs, i) -> new SaleRow(rs.getString("month"), rs.getString("currency").strip(),
                        rs.getLong("revenue"), rs.getInt("sales")))
                .list();
        List<ExpenseRow> expenseRows = jdbc.sql("""
                        SELECT to_char(spent_on, 'YYYY-MM') AS month, currency, SUM(amount_cents) AS total
                        FROM online_expenses WHERE business_id = :b GROUP BY 1, 2
                        """)
                .param("b", currentBusiness.id())
                .query((rs, i) -> new ExpenseRow(rs.getString("month"), rs.getString("currency").strip(),
                        rs.getLong("total")))
                .list();

        Map<String, Acc> byMonth = new TreeMap<>(java.util.Comparator.reverseOrder());
        for (SaleRow row : saleRows) {
            Acc acc = byMonth.computeIfAbsent(row.month(), k -> new Acc(new HashMap<>(), new HashMap<>(), 0));
            acc.revenue().merge(row.currency(), row.revenue(), Long::sum);
            byMonth.put(row.month(), new Acc(acc.revenue(), acc.expenses(), acc.sales() + row.sales()));
        }
        for (ExpenseRow row : expenseRows) {
            Acc acc = byMonth.computeIfAbsent(row.month(), k -> new Acc(new HashMap<>(), new HashMap<>(), 0));
            acc.expenses().merge(row.currency(), row.total(), Long::sum);
        }
        return byMonth.entrySet().stream().map(e -> {
            long revenue = currencyTotals.convertSubtotals(e.getValue().revenue(), currency);
            long expenses = currencyTotals.convertSubtotals(e.getValue().expenses(), currency);
            return new OnlineMonthResponse(e.getKey(), e.getValue().sales(), expenses, revenue,
                    revenue - expenses, currency);
        }).toList();
    }

    /** Deletes the online sales (restoring stock) and expenses of the given {@code YYYY-MM} months. */
    @Transactional
    public int deleteMonths(List<String> months) {
        int deleted = 0;
        for (String month : months) {
            YearMonth ym = parseMonth(month);
            OffsetDateTime from = ym.atDay(1).atStartOfDay().atOffset(ZoneOffset.UTC);
            OffsetDateTime to = ym.plusMonths(1).atDay(1).atStartOfDay().atOffset(ZoneOffset.UTC);
            List<Integer> saleIds = jdbc.sql("SELECT s.id FROM sales s WHERE " + ONLINE_SALES
                            + " AND s.sold_at >= :from AND s.sold_at < :to")
                    .param("b", currentBusiness.id())
                    .param("from", from)
                    .param("to", to)
                    .query(Integer.class)
                    .list();
            if (!saleIds.isEmpty()) {
                saleService.bulkDelete(saleIds);
                entityManager.flush();
            }
            int expenses = jdbc.sql("""
                            DELETE FROM online_expenses WHERE business_id = :b AND spent_on >= :f AND spent_on < :t
                            """)
                    .param("b", currentBusiness.id())
                    .param("f", ym.atDay(1))
                    .param("t", ym.plusMonths(1).atDay(1))
                    .update();
            deleted += saleIds.size() + expenses;
        }
        return deleted;
    }

    private static YearMonth parseMonth(String month) {
        try {
            return YearMonth.parse(month);
        } catch (DateTimeParseException e) {
            throw new BadRequestException("Month must look like 2026-05");
        }
    }

    @Transactional(readOnly = true)
    public List<OnlineExpenseResponse> listExpenses(String month) {
        LocalDate from = month == null ? null : parseMonth(month).atDay(1);
        LocalDate to = month == null ? null : parseMonth(month).plusMonths(1).atDay(1);
        return jdbc.sql("""
                        SELECT * FROM online_expenses
                        WHERE business_id = :b
                          AND (CAST(:f AS DATE) IS NULL OR (spent_on >= CAST(:f AS DATE) AND spent_on < CAST(:t AS DATE)))
                        ORDER BY spent_on DESC, id DESC
                        """)
                .param("b", currentBusiness.id())
                .param("f", from)
                .param("t", to)
                .query((rs, i) -> toResponse(rs))
                .list();
    }

    @Transactional
    public OnlineExpenseResponse createExpense(OnlineExpenseInput input) {
        int id = jdbc.sql("""
                        INSERT INTO online_expenses (business_id, spent_on, description, category, amount_cents,
                                                     currency, tags)
                        VALUES (:b, :spentOn, :description, :category, :amount, :currency, :tags)
                        RETURNING id
                        """)
                .params(columns(input))
                .query(Integer.class)
                .single();
        return getExpense(id);
    }

    @Transactional
    public OnlineExpenseResponse replaceExpense(int id, OnlineExpenseInput input) {
        int updated = jdbc.sql("""
                        UPDATE online_expenses SET spent_on = :spentOn, description = :description,
                               category = :category, amount_cents = :amount, currency = :currency, tags = :tags,
                               updated_at = now()
                        WHERE id = :id AND business_id = :b
                        """)
                .params(columns(input))
                .param("id", id)
                .update();
        if (updated == 0) {
            throw new NotFoundException("Online expense", id);
        }
        return getExpense(id);
    }

    @Transactional
    public void deleteExpense(int id) {
        int deleted = jdbc.sql("DELETE FROM online_expenses WHERE id = :id AND business_id = :b")
                .param("id", id)
                .param("b", currentBusiness.id())
                .update();
        if (deleted == 0) {
            throw new NotFoundException("Online expense", id);
        }
    }

    @Transactional
    public int bulkDeleteExpenses(List<Integer> ids) {
        return jdbc.sql("DELETE FROM online_expenses WHERE id IN (:ids) AND business_id = :b")
                .param("ids", ids)
                .param("b", currentBusiness.id())
                .update();
    }

    private OnlineExpenseResponse getExpense(int id) {
        return jdbc.sql("SELECT * FROM online_expenses WHERE id = :id AND business_id = :b")
                .param("id", id)
                .param("b", currentBusiness.id())
                .query((rs, i) -> toResponse(rs))
                .optional()
                .orElseThrow(() -> new NotFoundException("Online expense", id));
    }

    private Map<String, Object> columns(OnlineExpenseInput input) {
        Map<String, Object> params = new HashMap<>();
        params.put("b", currentBusiness.id());
        params.put("spentOn", input.spentOn());
        params.put("description", input.description());
        params.put("category", input.category());
        params.put("amount", input.amountCents());
        params.put("currency", input.currency());
        params.put("tags", input.tags().toArray(new String[0]));
        return params;
    }

    private static OnlineExpenseResponse toResponse(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new OnlineExpenseResponse(rs.getInt("id"), rs.getObject("spent_on", LocalDate.class),
                rs.getString("description"), rs.getString("category"), rs.getInt("amount_cents"),
                rs.getString("currency").strip(), List.of((String[]) rs.getArray("tags").getArray()),
                rs.getObject("created_at", OffsetDateTime.class).toInstant(),
                rs.getObject("updated_at", OffsetDateTime.class).toInstant());
    }
}
