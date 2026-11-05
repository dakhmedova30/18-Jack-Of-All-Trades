package ca.jackofalltrades.currency;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import org.springframework.stereotype.Service;

/** Converts already-aggregated currency subtotals to cents in the account's display currency. */
@Service
public class CurrencyTotals {

    private final ExchangeRateService rates;

    public CurrencyTotals(ExchangeRateService rates) {
        this.rates = rates;
    }

    public long convertCents(long cents, String sourceCurrency, String targetCurrency) {
        BigDecimal amount = BigDecimal.valueOf(cents, 2);
        BigDecimal converted = rates.convert(amount, sourceCurrency, targetCurrency);
        return converted.movePointRight(2).longValueExact();
    }

    /** Converts each source-currency subtotal once, then adds the rounded target-currency cents. */
    public long convertSubtotals(Map<String, Long> centsByCurrency, String targetCurrency) {
        long total = 0;
        for (Map.Entry<String, Long> entry : centsByCurrency.entrySet()) {
            total = Math.addExact(total, convertCents(entry.getValue(), entry.getKey(), targetCurrency));
        }
        return total;
    }

    public static long toCents(BigDecimal amount) {
        return amount.setScale(2, RoundingMode.HALF_UP).movePointRight(2).longValueExact();
    }
}
