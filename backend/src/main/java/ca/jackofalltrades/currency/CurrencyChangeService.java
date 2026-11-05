package ca.jackofalltrades.currency;

import ca.jackofalltrades.auth.Business;
import ca.jackofalltrades.auth.BusinessRepository;
import ca.jackofalltrades.common.api.NotFoundException;
import ca.jackofalltrades.common.security.CurrentBusiness;
import ca.jackofalltrades.items.Item;
import ca.jackofalltrades.items.ItemRepository;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CurrencyChangeService {

    private final BusinessRepository businesses;
    private final ItemRepository items;
    private final ExchangeRateService rates;
    private final CurrentBusiness currentBusiness;
    private final JdbcClient jdbc;
    private final EntityManager entityManager;

    public CurrencyChangeService(
            BusinessRepository businesses,
            ItemRepository items,
            ExchangeRateService rates,
            CurrentBusiness currentBusiness,
            JdbcClient jdbc,
            EntityManager entityManager) {
        this.businesses = businesses;
        this.items = items;
        this.rates = rates;
        this.currentBusiness = currentBusiness;
        this.jdbc = jdbc;
        this.entityManager = entityManager;
    }

    @Transactional(readOnly = true)
    public CurrencyPreview preview(String currency, boolean convertPrices) {
        String target = rates.validateConversionCurrency(currency);
        Business business = findBusiness();
        String source = business.getCurrency();
        ExchangeRateService.LocalRate rate = convertPrices
                ? rates.rateWithDate(source, target)
                : new ExchangeRateService.LocalRate(BigDecimal.ONE, null);
        List<Item> products = items.findAllByBusinessIdOrderByIdAsc(business.getId());
        List<CurrencyPreview.PriceSample> samples = products.stream()
                .limit(3)
                .map(item -> {
                    BigDecimal before = BigDecimal.valueOf(item.getUnitPriceCents(), 2);
                    return new CurrencyPreview.PriceSample(
                            item.getId(), item.getName(), before,
                            convertPrices ? rates.convert(before, source, target, rate.lookup()) : before);
                })
                .toList();
        return new CurrencyPreview(
                source,
                target,
                source.equals(target) ? 0 : products.size(),
                samples,
                rate.rate(),
                rate.asOfDate(),
                rate.source(),
                rate.asOf(),
                rate.lookup() == null ? null : rate.lookup().notice());
    }

    @Transactional
    public CurrencyChangeResult change(CurrencyChangeRequest request) {
        String target = rates.validateConversionCurrency(request.currency());
        Integer businessId = currentBusiness.id();
        Business business = businesses.findLockedById(businessId)
                .orElseThrow(() -> new NotFoundException("Business", businessId));
        String source = business.getCurrency();
        ExchangeRateService.LocalRate appliedRate = null;

        if (Boolean.TRUE.equals(request.convertPrices())) {
            List<Item> products = items.findAllLockedByBusinessId(businessId);
            appliedRate = products.isEmpty() || source.equals(target)
                    ? null
                    : rates.rateWithDate(source, target);
            for (Item item : products) {
                if (source.equals(target)) {
                    continue;
                }
                BigDecimal before = BigDecimal.valueOf(item.getUnitPriceCents(), 2);
                BigDecimal converted = rates.convert(before, source, target, appliedRate.lookup());
                int cents;
                try {
                    cents = converted.movePointRight(2).intValueExact();
                } catch (ArithmeticException ex) {
                    throw new ca.jackofalltrades.common.api.BadRequestException("Converted price is out of range");
                }
                item.convertPrice(cents, target);
            }
        } else {
            items.findAllLockedByBusinessId(businessId).forEach(item -> item.relabelCurrency(target));
            jdbc.sql("""
                    UPDATE sales s
                    SET currency = :currency,
                        original_currency = :currency,
                        original_amount = COALESCE((
                          SELECT SUM(line.total_cents)
                          FROM sale_items line
                          WHERE line.sale_id = s.id
                        ), 0)::NUMERIC / 100
                    WHERE business_id = :businessId
                    """)
                    .param("currency", target)
                    .param("businessId", businessId)
                    .update();
            jdbc.sql("""
                    UPDATE expenses e
                    SET currency = :currency,
                        original_currency = :currency,
                        original_amount = COALESCE((
                          SELECT SUM(line.total_cents)
                          FROM expense_items line
                          WHERE line.expense_id = e.id
                        ), 0)::NUMERIC / 100
                    WHERE business_id = :businessId
                    """)
                    .param("currency", target)
                    .param("businessId", businessId)
                    .update();
        }

        business.setCurrency(target);
        entityManager.flush();
        return new CurrencyChangeResult(
                business,
                appliedRate == null ? null : appliedRate.rate(),
                appliedRate == null ? null : appliedRate.asOfDate(),
                appliedRate == null ? null : appliedRate.source(),
                appliedRate == null ? null : appliedRate.asOf(),
                appliedRate == null || appliedRate.lookup() == null ? null : appliedRate.lookup().notice());
    }

    private Business findBusiness() {
        return businesses.findById(currentBusiness.id())
                .orElseThrow(() -> new NotFoundException("Business", currentBusiness.id()));
    }

}
