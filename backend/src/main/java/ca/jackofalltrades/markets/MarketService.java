package ca.jackofalltrades.markets;

import ca.jackofalltrades.common.api.NotFoundException;
import ca.jackofalltrades.common.security.CurrentBusiness;
import ca.jackofalltrades.currency.CurrencyTotals;
import ca.jackofalltrades.sales.SaleService;
import jakarta.persistence.EntityManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business rules for in-person markets. A market's sales are ordinary sales pointing at it, so
 * deleting a market deletes those sales through SaleService, which puts their stock back.
 */
@Service
public class MarketService {

    private record Totals(Map<String, Long> revenue, Map<String, Long> tips, int salesCount) {}

    private final JdbcClient jdbc;
    private final CurrentBusiness currentBusiness;
    private final CurrencyTotals currencyTotals;
    private final SaleService saleService;
    private final EntityManager entityManager;

    public MarketService(JdbcClient jdbc, CurrentBusiness currentBusiness, CurrencyTotals currencyTotals,
            SaleService saleService, EntityManager entityManager) {
        this.entityManager = entityManager;
        this.jdbc = jdbc;
        this.currentBusiness = currentBusiness;
        this.currencyTotals = currencyTotals;
        this.saleService = saleService;
    }

    /** Newest year first, then by start date within the year. */
    @Transactional(readOnly = true)
    public List<MarketResponse> list() {
        Map<Integer, Totals> totals = totals(null);
        return jdbc.sql("""
                        SELECT * FROM markets WHERE business_id = :b
                        ORDER BY extract(year FROM start_date) DESC, start_date, id
                        """)
                .param("b", currentBusiness.id())
                .query((rs, i) -> toResponse(rs, totals))
                .list();
    }

    @Transactional(readOnly = true)
    public MarketResponse get(int id) {
        Map<Integer, Totals> totals = totals(id);
        return jdbc.sql("SELECT * FROM markets WHERE id = :id AND business_id = :b")
                .param("id", id)
                .param("b", currentBusiness.id())
                .query((rs, i) -> toResponse(rs, totals))
                .optional()
                .orElseThrow(() -> new NotFoundException("Market", id));
    }

    @Transactional
    public MarketResponse create(MarketInput input) {
        int id = jdbc.sql("""
                        INSERT INTO markets (business_id, name, start_date, end_date, location, table_fee_cents,
                                             extra_expenses_cents, currency, website, status, going, tags)
                        VALUES (:b, :name, :startDate, :endDate, :location, :tableFee, :extra, :currency, :website,
                                :status, :going, :tags)
                        RETURNING id
                        """)
                .params(columns(input))
                .query(Integer.class)
                .single();
        return get(id);
    }

    @Transactional
    public MarketResponse replace(int id, MarketInput input) {
        int updated = jdbc.sql("""
                        UPDATE markets SET name = :name, start_date = :startDate, end_date = :endDate,
                               location = :location, table_fee_cents = :tableFee, extra_expenses_cents = :extra,
                               currency = :currency, website = :website, status = :status, going = :going,
                               tags = :tags, updated_at = now()
                        WHERE id = :id AND business_id = :b
                        """)
                .params(columns(input))
                .param("id", id)
                .update();
        if (updated == 0) {
            throw new NotFoundException("Market", id);
        }
        return get(id);
    }

    @Transactional
    public void delete(int id) {
        get(id);
        deleteSalesOf(List.of(id));
        jdbc.sql("DELETE FROM markets WHERE id = :id AND business_id = :b")
                .param("id", id)
                .param("b", currentBusiness.id())
                .update();
    }

    /** Deletes those of {@code ids} that are this business's markets, and their sales; others are skipped. */
    @Transactional
    public int bulkDelete(List<Integer> ids) {
        List<Integer> owned = jdbc.sql("SELECT id FROM markets WHERE id IN (:ids) AND business_id = :b")
                .param("ids", ids)
                .param("b", currentBusiness.id())
                .query(Integer.class)
                .list();
        if (owned.isEmpty()) {
            return 0;
        }
        deleteSalesOf(owned);
        return jdbc.sql("DELETE FROM markets WHERE id IN (:ids) AND business_id = :b")
                .param("ids", owned)
                .param("b", currentBusiness.id())
                .update();
    }

    private void deleteSalesOf(List<Integer> marketIds) {
        List<Integer> saleIds = jdbc.sql("SELECT id FROM sales WHERE market_id IN (:ids) AND business_id = :b")
                .param("ids", marketIds)
                .param("b", currentBusiness.id())
                .query(Integer.class)
                .list();
        if (!saleIds.isEmpty()) {
            saleService.bulkDelete(saleIds);
            entityManager.flush(); // the sales must be gone before the market's foreign key is checked
        }
    }

    private Map<String, Object> columns(MarketInput input) {
        Map<String, Object> params = new HashMap<>();
        params.put("b", currentBusiness.id());
        params.put("name", input.name());
        params.put("startDate", input.startDate());
        params.put("endDate", input.endDate());
        params.put("location", input.location());
        params.put("tableFee", input.tableFeeCents());
        params.put("extra", input.extraExpensesCents());
        params.put("currency", input.currency());
        params.put("website", input.website());
        params.put("status", input.status());
        params.put("going", input.going());
        params.put("tags", input.tags().toArray(new String[0]));
        return params;
    }

    /** Per-market revenue and tips by sale currency, and the number of item sales (tip-only sales excluded). */
    private Map<Integer, Totals> totals(Integer onlyMarketId) {
        record Row(int marketId, String currency, long revenue, long tips, int sales) {}
        List<Row> rows = jdbc.sql("""
                        SELECT s.market_id, s.original_currency AS currency,
                               COALESCE(SUM(si.total_cents), 0) AS revenue,
                               COALESCE(SUM(si.total_cents) FILTER (WHERE si.kind = 'TIP'), 0) AS tips,
                               COUNT(DISTINCT s.id) FILTER (WHERE si.kind <> 'TIP') AS sales
                        FROM sales s JOIN sale_items si ON si.sale_id = s.id
                        WHERE s.business_id = :b AND s.market_id IS NOT NULL
                          AND (CAST(:only AS INTEGER) IS NULL OR s.market_id = CAST(:only AS INTEGER))
                        GROUP BY s.market_id, s.original_currency
                        """)
                .param("b", currentBusiness.id())
                .param("only", onlyMarketId)
                .query((rs, i) -> new Row(rs.getInt("market_id"), rs.getString("currency"), rs.getLong("revenue"),
                        rs.getLong("tips"), rs.getInt("sales")))
                .list();
        Map<Integer, Totals> result = new HashMap<>();
        for (Row row : rows) {
            Totals totals = result.computeIfAbsent(row.marketId(),
                    k -> new Totals(new HashMap<>(), new HashMap<>(), 0));
            totals.revenue().merge(row.currency(), row.revenue(), Long::sum);
            totals.tips().merge(row.currency(), row.tips(), Long::sum);
            result.put(row.marketId(), new Totals(totals.revenue(), totals.tips(), totals.salesCount() + row.sales()));
        }
        return result;
    }

    private MarketResponse toResponse(ResultSet rs, Map<Integer, Totals> totals) throws SQLException {
        int id = rs.getInt("id");
        String currency = rs.getString("currency").strip();
        int tableFee = rs.getInt("table_fee_cents");
        int extra = rs.getInt("extra_expenses_cents");
        Totals t = totals.getOrDefault(id, new Totals(Map.of(), Map.of(), 0));
        long revenue = currencyTotals.convertSubtotals(t.revenue(), currency);
        long tips = currencyTotals.convertSubtotals(t.tips(), currency);
        long expenses = (long) tableFee + extra;
        return new MarketResponse(id, rs.getString("name"), rs.getObject("start_date", java.time.LocalDate.class),
                rs.getObject("end_date", java.time.LocalDate.class), rs.getString("location"), tableFee, extra,
                currency, rs.getString("website"), rs.getString("status"), rs.getString("going"),
                List.of((String[]) rs.getArray("tags").getArray()), expenses, revenue, tips, t.salesCount(),
                revenue - expenses, rs.getObject("created_at", OffsetDateTime.class).toInstant(),
                rs.getObject("updated_at", OffsetDateTime.class).toInstant());
    }
}
