package ca.jackofalltrades.discounts;

import ca.jackofalltrades.auth.BusinessRepository;
import ca.jackofalltrades.common.api.BadRequestException;
import ca.jackofalltrades.common.api.NotFoundException;
import ca.jackofalltrades.common.security.CurrentBusiness;
import ca.jackofalltrades.currency.CurrencyTotals;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Business rules for the discount and charge library. The business id always comes from CurrentBusiness. */
@Service
public class DiscountService {

    private final JdbcClient jdbc;
    private final CurrentBusiness currentBusiness;
    private final BusinessRepository businesses;
    private final CurrencyTotals currencyTotals;

    public DiscountService(JdbcClient jdbc, CurrentBusiness currentBusiness, BusinessRepository businesses,
            CurrencyTotals currencyTotals) {
        this.jdbc = jdbc;
        this.currentBusiness = currentBusiness;
        this.businesses = businesses;
        this.currencyTotals = currencyTotals;
    }

    @Transactional(readOnly = true)
    public List<DiscountResponse> list() {
        return jdbc.sql("SELECT * FROM discounts WHERE business_id = :b ORDER BY kind, lower(name), id")
                .param("b", currentBusiness.id())
                .query((rs, i) -> toResponse(rs))
                .list()
                .stream()
                .map(this::withTiers)
                .toList();
    }

    @Transactional(readOnly = true)
    public DiscountResponse get(int id) {
        return find(currentBusiness.id(), id).orElseThrow(() -> new NotFoundException("Discount", id));
    }

    /** Used by sales: the discount if it belongs to the business, otherwise empty. */
    @Transactional(readOnly = true)
    public Optional<DiscountResponse> find(int businessId, int id) {
        return jdbc.sql("SELECT * FROM discounts WHERE id = :id AND business_id = :b")
                .param("id", id)
                .param("b", businessId)
                .query((rs, i) -> toResponse(rs))
                .optional()
                .map(this::withTiers);
    }

    @Transactional
    public DiscountResponse create(DiscountInput input) {
        validate(input);
        int id = jdbc.sql("""
                        INSERT INTO discounts (business_id, name, applies_to, kind, is_charge, value_type, value,
                                               buy_count, get_count, currency)
                        VALUES (:b, :name, :appliesTo, :kind, :isCharge, :valueType, :value, :buy, :get, :currency)
                        RETURNING id
                        """)
                .params(columns(input))
                .query(Integer.class)
                .single();
        saveTiers(id, input);
        return get(id);
    }

    @Transactional
    public DiscountResponse replace(int id, DiscountInput input) {
        validate(input);
        int updated = jdbc.sql("""
                        UPDATE discounts SET name = :name, applies_to = :appliesTo, kind = :kind,
                               is_charge = :isCharge, value_type = :valueType, value = :value,
                               buy_count = :buy, get_count = :get, currency = :currency, updated_at = now()
                        WHERE id = :id AND business_id = :b
                        """)
                .params(columns(input))
                .param("id", id)
                .update();
        if (updated == 0) {
            throw new NotFoundException("Discount", id);
        }
        jdbc.sql("DELETE FROM discount_tiers WHERE discount_id = :id").param("id", id).update();
        saveTiers(id, input);
        return get(id);
    }

    @Transactional
    public void delete(int id) {
        int deleted = jdbc.sql("DELETE FROM discounts WHERE id = :id AND business_id = :b")
                .param("id", id)
                .param("b", currentBusiness.id())
                .update();
        if (deleted == 0) {
            throw new NotFoundException("Discount", id);
        }
    }

    /** Deletes those of {@code ids} that are this business's discounts; others are skipped. */
    @Transactional
    public int bulkDelete(List<Integer> ids) {
        return jdbc.sql("DELETE FROM discounts WHERE id IN (:ids) AND business_id = :b")
                .param("ids", ids)
                .param("b", currentBusiness.id())
                .update();
    }

    /** The distinct item tags a discount can apply to, for the form's dropdown. */
    @Transactional(readOnly = true)
    public List<String> appliesToOptions() {
        return jdbc.sql("""
                        SELECT DISTINCT tag FROM items, unnest(tags) AS tag
                        WHERE business_id = :b ORDER BY tag
                        """)
                .param("b", currentBusiness.id())
                .query(String.class)
                .list();
    }

    /** Converts a library discount into a rule priced in {@code saleCurrency}. */
    public DiscountCalculator.Rule toRule(DiscountResponse discount, String saleCurrency) {
        BigDecimal percent = "PERCENT".equals(discount.valueType()) ? discount.value() : null;
        long amountCents = 0;
        if (percent == null && discount.value() != null) {
            amountCents = convert(CurrencyTotals.toCents(discount.value()), discount.currency(), saleCurrency);
        }
        Map<Integer, Long> tiers = new LinkedHashMap<>();
        for (DiscountInput.Tier tier : discount.tiers()) {
            tiers.put(tier.count(), convert(tier.priceCents(), discount.currency(), saleCurrency));
        }
        return new DiscountCalculator.Rule(discount.kind(), percent, amountCents,
                discount.buyCount() == null ? 0 : discount.buyCount(),
                discount.getCount() == null ? 0 : discount.getCount(), tiers);
    }

    private long convert(long cents, String from, String to) {
        return from.equals(to) ? cents : currencyTotals.convertCents(cents, from, to);
    }

    private void validate(DiscountInput input) {
        switch (input.kind()) {
            case "PRESET" -> {
                if (input.buyCount() == null || input.getCount() == null) {
                    throw new BadRequestException("Enter how many to buy and how many to get");
                }
                requireValue(input);
            }
            case "SOLID" -> requireValue(input);
            case "PER_AMOUNT" -> {
                if (input.tiers().isEmpty()) {
                    throw new BadRequestException("Add at least one price break");
                }
                long distinct = input.tiers().stream().map(DiscountInput.Tier::count).distinct().count();
                if (distinct != input.tiers().size()) {
                    throw new BadRequestException("Each price break needs a different count");
                }
            }
            default -> throw new BadRequestException("Unknown discount type");
        }
    }

    private static void requireValue(DiscountInput input) {
        if (input.valueType() == null || input.value() == null) {
            throw new BadRequestException("Choose amount or percentage and enter a value");
        }
        if ("PERCENT".equals(input.valueType()) && input.value().compareTo(BigDecimal.valueOf(100)) > 0) {
            throw new BadRequestException("A percentage can't be more than 100");
        }
        if (input.value().scale() > 2) {
            throw new BadRequestException("Value can have at most 2 decimal places");
        }
    }

    private Map<String, Object> columns(DiscountInput input) {
        boolean perAmount = "PER_AMOUNT".equals(input.kind());
        boolean preset = "PRESET".equals(input.kind());
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("b", currentBusiness.id());
        params.put("name", input.name());
        params.put("appliesTo", input.appliesTo());
        params.put("kind", input.kind());
        params.put("isCharge", Boolean.TRUE.equals(input.isCharge()));
        params.put("valueType", perAmount ? null : input.valueType());
        params.put("value", perAmount ? null : input.value());
        params.put("buy", preset ? input.buyCount() : null);
        params.put("get", preset ? input.getCount() : null);
        params.put("currency", input.currency() != null ? input.currency() : accountCurrency());
        return params;
    }

    private void saveTiers(int id, DiscountInput input) {
        if (!"PER_AMOUNT".equals(input.kind())) {
            return;
        }
        for (DiscountInput.Tier tier : input.tiers()) {
            jdbc.sql("INSERT INTO discount_tiers (discount_id, item_count, price_cents) VALUES (:id, :c, :p)")
                    .param("id", id)
                    .param("c", tier.count())
                    .param("p", tier.priceCents())
                    .update();
        }
    }

    private String accountCurrency() {
        return businesses.findById(currentBusiness.id())
                .orElseThrow(() -> new NotFoundException("Business", currentBusiness.id()))
                .getCurrency();
    }

    private DiscountResponse withTiers(DiscountResponse discount) {
        List<DiscountInput.Tier> tiers = jdbc.sql("""
                        SELECT item_count, price_cents FROM discount_tiers WHERE discount_id = :id ORDER BY item_count
                        """)
                .param("id", discount.id())
                .query((rs, i) -> new DiscountInput.Tier(rs.getInt("item_count"), rs.getInt("price_cents")))
                .list();
        return new DiscountResponse(discount.id(), discount.name(), discount.appliesTo(), discount.kind(),
                discount.isCharge(), discount.valueType(), discount.value(), discount.buyCount(),
                discount.getCount(), tiers, discount.currency(), discount.createdAt(), discount.updatedAt());
    }

    private static DiscountResponse toResponse(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new DiscountResponse(rs.getInt("id"), rs.getString("name"), rs.getString("applies_to"),
                rs.getString("kind"), rs.getBoolean("is_charge"), rs.getString("value_type"),
                rs.getBigDecimal("value"), (Integer) rs.getObject("buy_count"), (Integer) rs.getObject("get_count"),
                List.of(), rs.getString("currency"), rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant());
    }
}
