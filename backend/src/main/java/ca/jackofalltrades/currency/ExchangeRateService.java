package ca.jackofalltrades.currency;

import ca.jackofalltrades.common.api.BadRequestException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Currency;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class ExchangeRateService {

    private static final Logger log = LoggerFactory.getLogger(ExchangeRateService.class);
    private static final int CURRENCY_SCALE = 2;
    private static final RoundingMode ROUNDING = RoundingMode.HALF_UP;
    private static final Set<String> CONVERSION_CURRENCIES = Set.of("CAD", "USD", "EUR", "GBP", "AUD");

    private final ExchangeRateHttpClient client;
    private final String baseUrl;
    private final Map<String, ExchangeRates> cache = new ConcurrentHashMap<>();

    public ExchangeRateService(
            ExchangeRateHttpClient client,
            @Value("${exchange-rate.api.base-url}") String baseUrl) {
        this.client = client;
        this.baseUrl = baseUrl;
    }

    public ExchangeRates latest(String baseCurrency) {
        String base = validateCurrency(baseCurrency);
        ExchangeRates cached = cache.get(base);
        if (cached != null && cached.refreshAt().isAfter(java.time.Instant.now())) {
            return cached;
        }
        synchronized (cache) {
            cached = cache.get(base);
            if (cached != null && cached.refreshAt().isAfter(java.time.Instant.now())) {
                return cached;
            }
            try {
                ExchangeRates fresh = ExchangeRates.from(client.fetch(baseUrl, base));
                if (!base.equals(fresh.baseCurrency())) {
                    throw new IllegalArgumentException("Exchange-rate response has an unexpected base currency");
                }
                cache.put(base, fresh);
                return fresh;
            } catch (RuntimeException error) {
                if (cached != null) {
                    log.warn("Exchange-rate refresh failed for {}; using rates as of {}", base, cached.asOfDate());
                    return cached;
                }
                log.warn("Exchange rates are unavailable for {}: {}", base, error.getMessage());
                throw new ExchangeRateUnavailableException();
            }
        }
    }

    public BigDecimal convert(BigDecimal amount, String sourceCurrency, String targetCurrency) {
        String source = validateCurrency(sourceCurrency);
        String target = validateCurrency(targetCurrency);
        if (source.equals(target)) {
            return amount.setScale(CURRENCY_SCALE, ROUNDING);
        }
        ExchangeRates rates = latest(source);
        BigDecimal sourceRate = rates.rates().get(source);
        BigDecimal targetRate = rates.rates().get(target);
        if (sourceRate == null || targetRate == null || sourceRate.signum() <= 0 || targetRate.signum() <= 0) {
            throw new ExchangeRateUnavailableException();
        }
        return amount.multiply(targetRate).divide(sourceRate, CURRENCY_SCALE, ROUNDING);
    }

    public BigDecimal rate(String sourceCurrency, String targetCurrency) {
        String source = validateCurrency(sourceCurrency);
        String target = validateCurrency(targetCurrency);
        if (source.equals(target)) {
            return BigDecimal.ONE;
        }
        ExchangeRates rates = latest(source);
        BigDecimal sourceRate = rates.rates().get(source);
        BigDecimal targetRate = rates.rates().get(target);
        if (sourceRate == null || targetRate == null || sourceRate.signum() <= 0 || targetRate.signum() <= 0) {
            throw new ExchangeRateUnavailableException();
        }
        return targetRate.divide(sourceRate, 12, ROUNDING);
    }

    public LocalRate rateWithDate(String sourceCurrency, String targetCurrency) {
        String source = validateCurrency(sourceCurrency);
        String target = validateCurrency(targetCurrency);
        if (source.equals(target)) {
            return new LocalRate(BigDecimal.ONE, java.time.LocalDate.now(java.time.ZoneOffset.UTC));
        }
        ExchangeRates rates = latest(source);
        BigDecimal sourceRate = rates.rates().get(source);
        BigDecimal targetRate = rates.rates().get(target);
        if (sourceRate == null || targetRate == null || sourceRate.signum() <= 0 || targetRate.signum() <= 0) {
            throw new ExchangeRateUnavailableException();
        }
        return new LocalRate(targetRate.divide(sourceRate, 12, ROUNDING), rates.asOfDate());
    }

    public static String validateCurrency(String code) {
        String normalized = code == null ? "" : code.strip().toUpperCase(Locale.ROOT);
        if (!normalized.matches("[A-Z]{3}")) {
            throw new BadRequestException("Enter a valid 3-letter currency code");
        }
        try {
            Currency.getInstance(normalized);
            return normalized;
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Currency code '" + normalized + "' is not supported");
        }
    }

    public static String validateConversionCurrency(String code) {
        String normalized = validateCurrency(code);
        if (!CONVERSION_CURRENCIES.contains(normalized)) {
            throw new BadRequestException("Currency conversion is available only for CAD, USD, EUR, GBP, and AUD");
        }
        return normalized;
    }

    public record LocalRate(BigDecimal rate, java.time.LocalDate asOfDate) {}
}
