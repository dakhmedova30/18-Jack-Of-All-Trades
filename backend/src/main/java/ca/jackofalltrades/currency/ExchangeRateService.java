package ca.jackofalltrades.currency;

import ca.jackofalltrades.common.api.BadRequestException;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Currency;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

@Service
public class ExchangeRateService {

    private static final Logger log = LoggerFactory.getLogger(ExchangeRateService.class);
    private static final int CURRENCY_SCALE = 2;
    private static final RoundingMode ROUNDING = RoundingMode.HALF_UP;
    private static final String BASE_CURRENCY = "USD";

    private final ExchangeRateHttpClient client;
    private final String baseUrl;
    private final String sourceMode;
    private final List<String> supportedCurrencies;
    private final Resource snapshotResource;
    private final ObjectMapper objectMapper;
    private final Map<String, RateLookup> cache = new ConcurrentHashMap<>();
    private volatile ExchangeRates snapshot;

    public ExchangeRateService(
            ExchangeRateHttpClient client,
            @Value("${exchange.rate.api.base-url}") String baseUrl,
            @Value("${exchange.rates.source:live}") String sourceMode,
            @Value("${exchange.supported-currencies}") List<String> supportedCurrencies,
            @Value("${exchange.rates.snapshot-location:classpath:exchange-rates-fallback.json}")
                    String snapshotLocation,
            ResourceLoader resourceLoader,
            ObjectMapper objectMapper) {
        this.client = client;
        this.baseUrl = baseUrl;
        this.sourceMode = sourceMode.strip().toLowerCase(Locale.ROOT);
        this.supportedCurrencies = supportedCurrencies.stream()
                .map(code -> code.strip().toUpperCase(Locale.ROOT))
                .distinct()
                .toList();
        this.snapshotResource = resourceLoader.getResource(snapshotLocation);
        this.objectMapper = objectMapper;
        validateConfiguration();
    }

    /** Returns the best available USD rate set and the metadata describing its origin. */
    public RateLookup latest() {
        if ("fallback".equals(sourceMode)) {
            return fromSnapshot();
        }

        RateLookup cached = cache.get(BASE_CURRENCY);
        Instant now = Instant.now();
        if (cached != null && now.isBefore(cached.rates().refreshAt())) {
            return cached.withSource(RateSource.CACHED);
        }

        synchronized (cache) {
            cached = cache.get(BASE_CURRENCY);
            now = Instant.now();
            if (cached != null && now.isBefore(cached.rates().refreshAt())) {
                return cached.withSource(RateSource.CACHED);
            }
            try {
                ExchangeRates fresh = ExchangeRates.from(client.fetch(baseUrl, BASE_CURRENCY));
                validateRates(fresh);
                RateLookup result = new RateLookup(fresh, RateSource.LIVE, fresh.asOf());
                cache.put(BASE_CURRENCY, result);
                return result;
            } catch (RuntimeException error) {
                if (cached != null) {
                    log.warn("Exchange-rate refresh failed; using rates as of {}", cached.asOf());
                    return cached.withSource(RateSource.STALE);
                }
                log.warn("Live exchange rates are unavailable: {}", error.getMessage());
                return fromSnapshot();
            }
        }
    }

    public BigDecimal convert(BigDecimal amount, String sourceCurrency, String targetCurrency) {
        String source = validateConversionCurrency(sourceCurrency);
        String target = validateConversionCurrency(targetCurrency);
        if (source.equals(target)) {
            return amount.setScale(CURRENCY_SCALE, ROUNDING);
        }
        return convert(amount, source, target, latest().rates());
    }

    public LocalRate rateWithDate(String sourceCurrency, String targetCurrency) {
        String source = validateConversionCurrency(sourceCurrency);
        String target = validateConversionCurrency(targetCurrency);
        RateLookup lookup = latest();
        return new LocalRate(crossRate(lookup.rates(), source, target), lookup);
    }

    public BigDecimal convert(BigDecimal amount, String sourceCurrency, String targetCurrency, RateLookup lookup) {
        String source = validateConversionCurrency(sourceCurrency);
        String target = validateConversionCurrency(targetCurrency);
        if (source.equals(target)) {
            return amount.setScale(CURRENCY_SCALE, ROUNDING);
        }
        return convert(amount, source, target, lookup.rates());
    }

    public String validateConversionCurrency(String code) {
        String normalized = code == null ? "" : code.strip().toUpperCase(Locale.ROOT);
        if (!supportedCurrencies.contains(normalized)) {
            throw new BadRequestException("Currency must be one of: " + String.join(", ", supportedCurrencies));
        }
        return normalized;
    }

    private static BigDecimal convert(BigDecimal amount, String source, String target, ExchangeRates rates) {
        BigDecimal sourceRate = rates.rates().get(source);
        BigDecimal targetRate = rates.rates().get(target);
        if (sourceRate == null || targetRate == null || sourceRate.signum() <= 0 || targetRate.signum() <= 0) {
            throw new ExchangeRateUnavailableException();
        }
        return amount.multiply(targetRate).divide(sourceRate, CURRENCY_SCALE, ROUNDING);
    }

    private static BigDecimal crossRate(ExchangeRates rates, String source, String target) {
        BigDecimal sourceRate = rates.rates().get(source);
        BigDecimal targetRate = rates.rates().get(target);
        if (sourceRate == null || targetRate == null || sourceRate.signum() <= 0 || targetRate.signum() <= 0) {
            throw new ExchangeRateUnavailableException();
        }
        return targetRate.divide(sourceRate, 12, ROUNDING);
    }

    private RateLookup fromSnapshot() {
        try {
            ExchangeRates rates = snapshot;
            if (rates == null) {
                synchronized (this) {
                    rates = snapshot;
                    if (rates == null) {
                        rates = ExchangeRates.from(readSnapshot());
                        validateRates(rates);
                        snapshot = rates;
                    }
                }
            }
            return new RateLookup(rates, RateSource.FALLBACK, rates.asOf());
        } catch (RuntimeException error) {
            log.error("Fallback exchange rates are unavailable: {}", error.getMessage());
            throw new ExchangeRateUnavailableException();
        }
    }

    private ExchangeRateResponse readSnapshot() {
        try (var input = snapshotResource.getInputStream()) {
            return objectMapper.readValue(input, ExchangeRateResponse.class);
        } catch (IOException error) {
            throw new IllegalStateException("Could not read exchange-rates-fallback.json", error);
        }
    }

    private void validateConfiguration() {
        if (!"live".equals(sourceMode) && !"fallback".equals(sourceMode)) {
            throw new IllegalStateException("exchange.rates.source must be either 'live' or 'fallback'");
        }
        if (supportedCurrencies.isEmpty()) {
            throw new IllegalStateException("exchange.supported-currencies must contain at least one currency");
        }
        for (String code : supportedCurrencies) {
            if (!code.matches("[A-Z]{3}")) {
                throw new IllegalStateException("Invalid exchange.supported-currencies entry: " + code);
            }
            try {
                Currency.getInstance(code);
            } catch (IllegalArgumentException error) {
                throw new IllegalStateException("Unsupported exchange.supported-currencies entry: " + code, error);
            }
        }
        try {
            ExchangeRates configuredSnapshot = ExchangeRates.from(readSnapshot());
            validateRates(configuredSnapshot);
        } catch (RuntimeException error) {
            throw new IllegalStateException("Invalid exchange-rates-fallback.json: " + error.getMessage(), error);
        }
    }

    private void validateRates(ExchangeRates rates) {
        if (!BASE_CURRENCY.equals(rates.baseCurrency())) {
            throw new IllegalStateException("Exchange-rate data must use base_code USD");
        }
        List<String> missing = supportedCurrencies.stream()
                .filter(code -> !rates.rates().containsKey(code))
                .sorted()
                .toList();
        if (!missing.isEmpty()) {
            throw new IllegalStateException(
                    "Exchange-rate data is missing supported currencies: " + String.join(", ", missing));
        }
    }

    public enum RateSource {
        LIVE,
        CACHED,
        STALE,
        FALLBACK
    }

    public record RateLookup(ExchangeRates rates, RateSource source, Instant asOf) {
        RateLookup withSource(RateSource nextSource) {
            return new RateLookup(rates, nextSource, asOf);
        }
    }

    public record LocalRate(BigDecimal rate, RateLookup lookup) {
        public RateSource source() {
            return lookup == null ? null : lookup.source();
        }

        public Instant asOf() {
            return lookup == null ? null : lookup.asOf();
        }

        public LocalDate asOfDate() {
            return asOf() == null ? null : asOf().atZone(ZoneOffset.UTC).toLocalDate();
        }
    }
}
