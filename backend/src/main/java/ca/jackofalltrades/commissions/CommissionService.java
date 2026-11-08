package ca.jackofalltrades.commissions;

import ca.jackofalltrades.auth.Business;
import ca.jackofalltrades.auth.BusinessRepository;
import ca.jackofalltrades.common.api.NotFoundException;
import ca.jackofalltrades.common.security.CurrentBusiness;
import ca.jackofalltrades.currency.CurrencyTotals;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Business rules for commissions and their linked expenses. */
@Service
public class CommissionService {

    private record Totals(Map<String, Long> revenue, Map<String, Long> expenses, int salesCount) {}

    private final JdbcClient jdbc;
    private final CurrentBusiness currentBusiness;
    private final BusinessRepository businesses;
    private final CurrencyTotals currencyTotals;

    public CommissionService(JdbcClient jdbc, CurrentBusiness currentBusiness, BusinessRepository businesses,
            CurrencyTotals currencyTotals) {
        this.jdbc = jdbc;
        this.currentBusiness = currentBusiness;
        this.businesses = businesses;
        this.currencyTotals = currencyTotals;
    }

    @Transactional(readOnly = true)
    public List<CommissionResponse> list() {
        Map<Integer, Totals> totals = totals(null);
        String currency = accountCurrency();
        return jdbc.sql("SELECT * FROM commissions WHERE business_id = :b ORDER BY deadline, id")
                .param("b", currentBusiness.id())
                .query((rs, i) -> toResponse(rs, totals, currency))
                .list();
    }

    @Transactional(readOnly = true)
    public CommissionResponse get(int id) {
        return jdbc.sql("SELECT * FROM commissions WHERE id = :id AND business_id = :b")
                .param("id", id)
                .param("b", currentBusiness.id())
                .query((rs, i) -> toResponse(rs, totals(id), accountCurrency()))
                .optional()
                .orElseThrow(() -> new NotFoundException("Commission", id));
    }

    @Transactional
    public CommissionResponse create(CommissionInput input) {
        int id = jdbc.sql("""
                        INSERT INTO commissions (business_id, name, contact, request, deadline, tags)
                        VALUES (:b, :name, :contact, :request, :deadline, :tags)
                        RETURNING id
                        """)
                .params(columns(input))
                .query(Integer.class)
                .single();
        return get(id);
    }

    @Transactional
    public CommissionResponse replace(int id, CommissionInput input) {
        int updated = jdbc.sql("""
                        UPDATE commissions SET name = :name, contact = :contact, request = :request,
                               deadline = :deadline, tags = :tags, updated_at = now()
                        WHERE id = :id AND business_id = :b
                        """)
                .params(columns(input))
                .param("id", id)
                .update();
        if (updated == 0) {
            throw new NotFoundException("Commission", id);
        }
        return get(id);
    }

    /** Keeps linked sales and expenses; the foreign-key links are explicitly detached before deletion. */
    @Transactional
    public void delete(int id) {
        get(id);
        detach(List.of(id));
        jdbc.sql("DELETE FROM commissions WHERE id = :id AND business_id = :b")
                .param("id", id)
                .param("b", currentBusiness.id())
                .update();
    }

    @Transactional
    public int bulkDelete(List<Integer> ids) {
        List<Integer> owned = jdbc.sql("SELECT id FROM commissions WHERE id IN (:ids) AND business_id = :b")
                .param("ids", ids)
                .param("b", currentBusiness.id())
                .query(Integer.class)
                .list();
        if (owned.isEmpty()) {
            return 0;
        }
        detach(owned);
        return jdbc.sql("DELETE FROM commissions WHERE id IN (:ids) AND business_id = :b")
                .param("ids", owned)
                .param("b", currentBusiness.id())
                .update();
    }

    @Transactional(readOnly = true)
    public List<CommissionExpenseResponse> expenses(int commissionId) {
        requireCommission(commissionId);
        return jdbc.sql("""
                        SELECT * FROM commission_expenses
                        WHERE business_id = :b AND commission_id = :c
                        ORDER BY spent_on DESC, id DESC
                        """)
                .param("b", currentBusiness.id())
                .param("c", commissionId)
                .query(CommissionService::expenseResponse)
                .list();
    }

    @Transactional(readOnly = true)
    public List<CommissionExpenseResponse> unassignedExpenses() {
        return jdbc.sql("""
                        SELECT * FROM commission_expenses
                        WHERE business_id = :b AND commission_id IS NULL
                        ORDER BY spent_on DESC, id DESC
                        """)
                .param("b", currentBusiness.id())
                .query(CommissionService::expenseResponse)
                .list();
    }

    @Transactional
    public void deleteUnassignedExpense(int id) {
        int deleted = jdbc.sql("""
                        DELETE FROM commission_expenses
                        WHERE id = :id AND business_id = :b AND commission_id IS NULL
                        """)
                .param("id", id)
                .param("b", currentBusiness.id())
                .update();
        if (deleted == 0) {
            throw new NotFoundException("Unassigned commission expense", id);
        }
    }

    @Transactional
    public int bulkDeleteUnassignedExpenses(List<Integer> ids) {
        return jdbc.sql("""
                        DELETE FROM commission_expenses
                        WHERE id IN (:ids) AND business_id = :b AND commission_id IS NULL
                        """)
                .param("ids", ids)
                .param("b", currentBusiness.id())
                .update();
    }

    @Transactional
    public CommissionExpenseResponse createExpense(int commissionId, CommissionExpenseInput input) {
        requireCommission(commissionId);
        int id = jdbc.sql("""
                        INSERT INTO commission_expenses
                            (business_id, commission_id, spent_on, description, category, amount_cents, currency, tags)
                        VALUES (:b, :commission, :spentOn, :description, :category, :amount, :currency, :tags)
                        RETURNING id
                        """)
                .params(expenseColumns(input))
                .param("commission", commissionId)
                .query(Integer.class)
                .single();
        return getExpense(commissionId, id);
    }

    @Transactional
    public CommissionExpenseResponse replaceExpense(int commissionId, int id, CommissionExpenseInput input) {
        int updated = jdbc.sql("""
                        UPDATE commission_expenses SET spent_on = :spentOn, description = :description,
                               category = :category, amount_cents = :amount, currency = :currency,
                               tags = :tags, updated_at = now()
                        WHERE id = :id AND commission_id = :commission AND business_id = :b
                        """)
                .params(expenseColumns(input))
                .param("id", id)
                .param("commission", commissionId)
                .update();
        if (updated == 0) {
            throw new NotFoundException("Commission expense", id);
        }
        return getExpense(commissionId, id);
    }

    @Transactional
    public void deleteExpense(int commissionId, int id) {
        int deleted = jdbc.sql("""
                        DELETE FROM commission_expenses
                        WHERE id = :id AND commission_id = :commission AND business_id = :b
                        """)
                .param("id", id)
                .param("commission", commissionId)
                .param("b", currentBusiness.id())
                .update();
        if (deleted == 0) {
            throw new NotFoundException("Commission expense", id);
        }
    }

    @Transactional
    public int bulkDeleteExpenses(int commissionId, List<Integer> ids) {
        requireCommission(commissionId);
        return jdbc.sql("""
                        DELETE FROM commission_expenses
                        WHERE id IN (:ids) AND commission_id = :commission AND business_id = :b
                        """)
                .param("ids", ids)
                .param("commission", commissionId)
                .param("b", currentBusiness.id())
                .update();
    }

    private void requireCommission(int id) {
        if (!jdbc.sql("SELECT EXISTS (SELECT 1 FROM commissions WHERE id = :id AND business_id = :b)")
                .param("id", id)
                .param("b", currentBusiness.id())
                .query(Boolean.class)
                .single()) {
            throw new NotFoundException("Commission", id);
        }
    }

    private void detach(List<Integer> ids) {
        jdbc.sql("UPDATE sales SET commission_id = NULL WHERE commission_id IN (:ids) AND business_id = :b")
                .param("ids", ids)
                .param("b", currentBusiness.id())
                .update();
        jdbc.sql("UPDATE commission_expenses SET commission_id = NULL WHERE commission_id IN (:ids) AND business_id = :b")
                .param("ids", ids)
                .param("b", currentBusiness.id())
                .update();
    }

    private CommissionExpenseResponse getExpense(int commissionId, int id) {
        return jdbc.sql("""
                        SELECT * FROM commission_expenses
                        WHERE id = :id AND commission_id = :commission AND business_id = :b
                        """)
                .param("id", id)
                .param("commission", commissionId)
                .param("b", currentBusiness.id())
                .query(CommissionService::expenseResponse)
                .optional()
                .orElseThrow(() -> new NotFoundException("Commission expense", id));
    }

    private Map<String, Object> columns(CommissionInput input) {
        Map<String, Object> params = new HashMap<>();
        params.put("b", currentBusiness.id());
        params.put("name", input.name());
        params.put("contact", input.contact());
        params.put("request", input.request());
        params.put("deadline", input.deadline());
        params.put("tags", input.tags().toArray(String[]::new));
        return params;
    }

    private Map<String, Object> expenseColumns(CommissionExpenseInput input) {
        Map<String, Object> params = new HashMap<>();
        params.put("b", currentBusiness.id());
        params.put("spentOn", input.spentOn());
        params.put("description", input.description());
        params.put("category", input.category());
        params.put("amount", input.amountCents());
        params.put("currency", input.currency());
        params.put("tags", input.tags().toArray(String[]::new));
        return params;
    }

    private Map<Integer, Totals> totals(Integer onlyCommissionId) {
        record Row(int commissionId, String currency, long amount) {}
        Map<Integer, Totals> result = new HashMap<>();
        jdbc.sql("""
                        SELECT commission_id, original_currency AS currency,
                               SUM(COALESCE((SELECT SUM(si.total_cents) FROM sale_items si WHERE si.sale_id = s.id), 0)) amount,
                               COUNT(*) AS sales
                        FROM sales s
                        WHERE business_id = :b AND commission_id IS NOT NULL
                          AND (CAST(:only AS INTEGER) IS NULL OR commission_id = CAST(:only AS INTEGER))
                        GROUP BY commission_id, original_currency
                        """)
                .param("b", currentBusiness.id())
                .param("only", onlyCommissionId)
                .query((rs, i) -> Map.entry(
                        new Row(rs.getInt("commission_id"), rs.getString("currency").strip(), rs.getLong("amount")),
                        rs.getInt("sales")))
                .list()
                .forEach(entry -> {
                    Totals current = result.computeIfAbsent(entry.getKey().commissionId(),
                            key -> new Totals(new HashMap<>(), new HashMap<>(), 0));
                    current.revenue().merge(entry.getKey().currency(), entry.getKey().amount(), Long::sum);
                    result.put(entry.getKey().commissionId(),
                            new Totals(current.revenue(), current.expenses(), current.salesCount() + entry.getValue()));
                });
        jdbc.sql("""
                        SELECT commission_id, currency, SUM(amount_cents) amount
                        FROM commission_expenses
                        WHERE business_id = :b AND commission_id IS NOT NULL
                          AND (CAST(:only AS INTEGER) IS NULL OR commission_id = CAST(:only AS INTEGER))
                        GROUP BY commission_id, currency
                        """)
                .param("b", currentBusiness.id())
                .param("only", onlyCommissionId)
                .query((rs, i) -> new Row(rs.getInt("commission_id"), rs.getString("currency").strip(),
                        rs.getLong("amount")))
                .list()
                .forEach(row -> {
                    Totals current = result.computeIfAbsent(row.commissionId(),
                            key -> new Totals(new HashMap<>(), new HashMap<>(), 0));
                    current.expenses().merge(row.currency(), row.amount(), Long::sum);
                });
        return result;
    }

    private CommissionResponse toResponse(ResultSet rs, Map<Integer, Totals> totals, String currency)
            throws SQLException {
        int id = rs.getInt("id");
        Totals amounts = totals.getOrDefault(id, new Totals(Map.of(), Map.of(), 0));
        long revenue = currencyTotals.convertSubtotals(amounts.revenue(), currency);
        long expenses = currencyTotals.convertSubtotals(amounts.expenses(), currency);
        return new CommissionResponse(id, rs.getString("name"), rs.getString("contact"), rs.getString("request"),
                rs.getObject("deadline", LocalDate.class), List.of((String[]) rs.getArray("tags").getArray()),
                amounts.salesCount(), expenses, revenue, revenue - expenses, currency,
                rs.getObject("created_at", OffsetDateTime.class).toInstant(),
                rs.getObject("updated_at", OffsetDateTime.class).toInstant());
    }

    private String accountCurrency() {
        return businesses.findById(currentBusiness.id())
                .map(Business::getCurrency)
                .orElseThrow(() -> new NotFoundException("Business", currentBusiness.id()));
    }

    private static CommissionExpenseResponse expenseResponse(ResultSet rs, int rowNum) throws SQLException {
        return new CommissionExpenseResponse(rs.getInt("id"), rs.getObject("commission_id", Integer.class),
                rs.getObject("spent_on", LocalDate.class), rs.getString("description"), rs.getString("category"),
                rs.getInt("amount_cents"), rs.getString("currency").strip(),
                List.of((String[]) rs.getArray("tags").getArray()),
                rs.getObject("created_at", OffsetDateTime.class).toInstant(),
                rs.getObject("updated_at", OffsetDateTime.class).toInstant());
    }
}
