package ca.jackofalltrades.miscellaneous;

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

/** Miscellaneous sale groups and their linked expenses. */
@Service
public class MiscellaneousService {

    private record Totals(Map<String, Long> revenue, Map<String, Long> expenses, int salesCount) {}

    private final JdbcClient jdbc;
    private final CurrentBusiness currentBusiness;
    private final BusinessRepository businesses;
    private final CurrencyTotals currencyTotals;

    public MiscellaneousService(
            JdbcClient jdbc, CurrentBusiness currentBusiness, BusinessRepository businesses, CurrencyTotals currencyTotals) {
        this.jdbc = jdbc;
        this.currentBusiness = currentBusiness;
        this.businesses = businesses;
        this.currencyTotals = currencyTotals;
    }

    @Transactional(readOnly = true)
    public List<MiscellaneousResponse> list() {
        Map<Integer, Totals> totals = totals(null);
        String currency = accountCurrency();
        return jdbc.sql("SELECT * FROM miscellaneous_records WHERE business_id = :b ORDER BY name, id")
                .param("b", currentBusiness.id())
                .query((rs, i) -> toResponse(rs, totals, currency))
                .list();
    }

    @Transactional(readOnly = true)
    public MiscellaneousResponse get(int id) {
        return jdbc.sql("SELECT * FROM miscellaneous_records WHERE id = :id AND business_id = :b")
                .param("id", id)
                .param("b", currentBusiness.id())
                .query((rs, i) -> toResponse(rs, totals(id), accountCurrency()))
                .optional()
                .orElseThrow(() -> new NotFoundException("Miscellaneous record", id));
    }

    @Transactional
    public MiscellaneousResponse create(MiscellaneousInput input) {
        int id = jdbc.sql("""
                        INSERT INTO miscellaneous_records (business_id, name, received_on, tags)
                        VALUES (:b, :name, COALESCE(CAST(:receivedOn AS DATE), CURRENT_DATE), :tags)
                        RETURNING id
                        """)
                .params(columns(input))
                .query(Integer.class)
                .single();
        return get(id);
    }

    @Transactional
    public MiscellaneousResponse replace(int id, MiscellaneousInput input) {
        int updated = jdbc.sql("""
                        UPDATE miscellaneous_records SET name = :name,
                               received_on = COALESCE(CAST(:receivedOn AS DATE), received_on),
                               tags = :tags, updated_at = now()
                        WHERE id = :id AND business_id = :b
                        """)
                .params(columns(input))
                .param("id", id)
                .update();
        if (updated == 0) {
            throw new NotFoundException("Miscellaneous record", id);
        }
        return get(id);
    }

    @Transactional
    public void delete(int id) {
        get(id);
        detach(List.of(id));
        jdbc.sql("DELETE FROM miscellaneous_records WHERE id = :id AND business_id = :b")
                .param("id", id)
                .param("b", currentBusiness.id())
                .update();
    }

    @Transactional
    public int bulkDelete(List<Integer> ids) {
        List<Integer> owned = jdbc.sql(
                        "SELECT id FROM miscellaneous_records WHERE id IN (:ids) AND business_id = :b")
                .param("ids", ids)
                .param("b", currentBusiness.id())
                .query(Integer.class)
                .list();
        if (owned.isEmpty()) return 0;
        detach(owned);
        return jdbc.sql("DELETE FROM miscellaneous_records WHERE id IN (:ids) AND business_id = :b")
                .param("ids", owned)
                .param("b", currentBusiness.id())
                .update();
    }

    @Transactional(readOnly = true)
    public List<MiscExpenseResponse> expenses(int miscId) {
        requireRecord(miscId);
        return jdbc.sql("""
                        SELECT * FROM misc_expenses WHERE business_id = :b AND misc_id = :misc
                        ORDER BY spent_on DESC, id DESC
                        """)
                .param("b", currentBusiness.id())
                .param("misc", miscId)
                .query(MiscellaneousService::expenseResponse)
                .list();
    }

    @Transactional
    public MiscExpenseResponse createExpense(int miscId, MiscExpenseInput input) {
        requireRecord(miscId);
        int id = jdbc.sql("""
                        INSERT INTO misc_expenses
                            (business_id, misc_id, spent_on, description, category, amount_cents, currency, tags)
                        VALUES (:b, :misc, :spentOn, :description, :category, :amount, :currency, :tags)
                        RETURNING id
                        """)
                .params(expenseColumns(input))
                .param("misc", miscId)
                .query(Integer.class)
                .single();
        return getExpense(miscId, id);
    }

    @Transactional
    public MiscExpenseResponse replaceExpense(int miscId, int id, MiscExpenseInput input) {
        int updated = jdbc.sql("""
                        UPDATE misc_expenses SET spent_on = :spentOn, description = :description,
                               category = :category, amount_cents = :amount, currency = :currency,
                               tags = :tags, updated_at = now()
                        WHERE id = :id AND misc_id = :misc AND business_id = :b
                        """)
                .params(expenseColumns(input))
                .param("id", id)
                .param("misc", miscId)
                .update();
        if (updated == 0) throw new NotFoundException("Miscellaneous expense", id);
        return getExpense(miscId, id);
    }

    @Transactional
    public void deleteExpense(int miscId, int id) {
        int deleted = jdbc.sql("""
                        DELETE FROM misc_expenses
                        WHERE id = :id AND misc_id = :misc AND business_id = :b
                        """)
                .param("id", id)
                .param("misc", miscId)
                .param("b", currentBusiness.id())
                .update();
        if (deleted == 0) throw new NotFoundException("Miscellaneous expense", id);
    }

    @Transactional
    public int bulkDeleteExpenses(int miscId, List<Integer> ids) {
        requireRecord(miscId);
        return jdbc.sql("""
                        DELETE FROM misc_expenses
                        WHERE id IN (:ids) AND misc_id = :misc AND business_id = :b
                        """)
                .param("ids", ids)
                .param("misc", miscId)
                .param("b", currentBusiness.id())
                .update();
    }

    @Transactional(readOnly = true)
    public List<MiscExpenseResponse> unassignedExpenses() {
        return jdbc.sql("""
                        SELECT * FROM misc_expenses WHERE business_id = :b AND misc_id IS NULL
                        ORDER BY spent_on DESC, id DESC
                        """)
                .param("b", currentBusiness.id())
                .query(MiscellaneousService::expenseResponse)
                .list();
    }

    @Transactional
    public void deleteUnassignedExpense(int id) {
        int deleted = jdbc.sql("""
                        DELETE FROM misc_expenses
                        WHERE id = :id AND business_id = :b AND misc_id IS NULL
                        """)
                .param("id", id)
                .param("b", currentBusiness.id())
                .update();
        if (deleted == 0) throw new NotFoundException("Unassigned miscellaneous expense", id);
    }

    @Transactional
    public int bulkDeleteUnassignedExpenses(List<Integer> ids) {
        return jdbc.sql("""
                        DELETE FROM misc_expenses
                        WHERE id IN (:ids) AND business_id = :b AND misc_id IS NULL
                        """)
                .param("ids", ids)
                .param("b", currentBusiness.id())
                .update();
    }

    private void requireRecord(int id) {
        if (!jdbc.sql("SELECT EXISTS (SELECT 1 FROM miscellaneous_records WHERE id = :id AND business_id = :b)")
                .param("id", id)
                .param("b", currentBusiness.id())
                .query(Boolean.class)
                .single()) {
            throw new NotFoundException("Miscellaneous record", id);
        }
    }

    private void detach(List<Integer> ids) {
        jdbc.sql("UPDATE sales SET misc_id = NULL WHERE misc_id IN (:ids) AND business_id = :b")
                .param("ids", ids)
                .param("b", currentBusiness.id())
                .update();
        jdbc.sql("UPDATE misc_expenses SET misc_id = NULL WHERE misc_id IN (:ids) AND business_id = :b")
                .param("ids", ids)
                .param("b", currentBusiness.id())
                .update();
    }

    private MiscExpenseResponse getExpense(int miscId, int id) {
        return jdbc.sql("""
                        SELECT * FROM misc_expenses
                        WHERE id = :id AND misc_id = :misc AND business_id = :b
                        """)
                .param("id", id)
                .param("misc", miscId)
                .param("b", currentBusiness.id())
                .query(MiscellaneousService::expenseResponse)
                .optional()
                .orElseThrow(() -> new NotFoundException("Miscellaneous expense", id));
    }

    private Map<String, Object> columns(MiscellaneousInput input) {
        Map<String, Object> params = new HashMap<>();
        params.put("b", currentBusiness.id());
        params.put("name", input.name());
        params.put("receivedOn", input.receivedOn());
        params.put("tags", input.tags().toArray(String[]::new));
        return params;
    }

    private Map<String, Object> expenseColumns(MiscExpenseInput input) {
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

    private Map<Integer, Totals> totals(Integer onlyId) {
        record Row(int id, String currency, long amount) {}
        Map<Integer, Totals> result = new HashMap<>();
        jdbc.sql("""
                        SELECT misc_id, original_currency AS currency,
                               SUM(COALESCE((SELECT SUM(si.total_cents) FROM sale_items si WHERE si.sale_id = s.id), 0)) amount,
                               COUNT(*) AS sales
                        FROM sales s
                        WHERE business_id = :b AND misc_id IS NOT NULL
                          AND (CAST(:only AS INTEGER) IS NULL OR misc_id = CAST(:only AS INTEGER))
                        GROUP BY misc_id, original_currency
                        """)
                .param("b", currentBusiness.id())
                .param("only", onlyId)
                .query((rs, i) -> Map.entry(
                        new Row(rs.getInt("misc_id"), rs.getString("currency").strip(), rs.getLong("amount")),
                        rs.getInt("sales")))
                .list()
                .forEach(entry -> {
                    Totals current = result.computeIfAbsent(entry.getKey().id(),
                            key -> new Totals(new HashMap<>(), new HashMap<>(), 0));
                    current.revenue().merge(entry.getKey().currency(), entry.getKey().amount(), Long::sum);
                    result.put(entry.getKey().id(),
                            new Totals(current.revenue(), current.expenses(), current.salesCount() + entry.getValue()));
                });
        jdbc.sql("""
                        SELECT misc_id, currency, SUM(amount_cents) amount
                        FROM misc_expenses WHERE business_id = :b AND misc_id IS NOT NULL
                          AND (CAST(:only AS INTEGER) IS NULL OR misc_id = CAST(:only AS INTEGER))
                        GROUP BY misc_id, currency
                        """)
                .param("b", currentBusiness.id())
                .param("only", onlyId)
                .query((rs, i) -> new Row(rs.getInt("misc_id"), rs.getString("currency").strip(), rs.getLong("amount")))
                .list()
                .forEach(row -> {
                    Totals current = result.computeIfAbsent(row.id(),
                            key -> new Totals(new HashMap<>(), new HashMap<>(), 0));
                    current.expenses().merge(row.currency(), row.amount(), Long::sum);
                });
        return result;
    }

    private MiscellaneousResponse toResponse(ResultSet rs, Map<Integer, Totals> totals, String currency)
            throws SQLException {
        int id = rs.getInt("id");
        Totals amount = totals.getOrDefault(id, new Totals(Map.of(), Map.of(), 0));
        long revenue = currencyTotals.convertSubtotals(amount.revenue(), currency);
        long expenses = currencyTotals.convertSubtotals(amount.expenses(), currency);
        return new MiscellaneousResponse(id, rs.getString("name"), rs.getObject("received_on", LocalDate.class),
                List.of((String[]) rs.getArray("tags").getArray()), amount.salesCount(),
                expenses, revenue, revenue - expenses, currency,
                rs.getObject("created_at", OffsetDateTime.class).toInstant(),
                rs.getObject("updated_at", OffsetDateTime.class).toInstant());
    }

    private String accountCurrency() {
        return businesses.findById(currentBusiness.id())
                .map(Business::getCurrency)
                .orElseThrow(() -> new NotFoundException("Business", currentBusiness.id()));
    }

    private static MiscExpenseResponse expenseResponse(ResultSet rs, int rowNum) throws SQLException {
        return new MiscExpenseResponse(rs.getInt("id"), rs.getObject("misc_id", Integer.class),
                rs.getObject("spent_on", LocalDate.class), rs.getString("description"), rs.getString("category"),
                rs.getInt("amount_cents"), rs.getString("currency").strip(),
                List.of((String[]) rs.getArray("tags").getArray()),
                rs.getObject("created_at", OffsetDateTime.class).toInstant(),
                rs.getObject("updated_at", OffsetDateTime.class).toInstant());
    }
}
