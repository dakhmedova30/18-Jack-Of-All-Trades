package ca.jackofalltrades.currency;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record CurrencyPreview(
        String fromCurrency,
        String toCurrency,
        int productsAffected,
        List<PriceSample> samples,
        BigDecimal rate,
        LocalDate rateDate) {

    public record PriceSample(Integer itemId, String name, BigDecimal beforePrice, BigDecimal afterPrice) {}
}
