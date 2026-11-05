package ca.jackofalltrades.currency;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayDeque;
import java.util.List;
import java.util.Map;
import java.util.Queue;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.io.DefaultResourceLoader;
import tools.jackson.databind.json.JsonMapper;

class ExchangeRateServiceTest {

    private static final List<String> SUPPORTED = List.of("CAD", "USD", "EUR", "GBP", "AUD");

    @Test
    void convertsWithUsdCrossRatesAndRoundsHalfUp() {
        FakeClient client = new FakeClient(response(future(), Map.of(
                "USD", BigDecimal.ONE,
                "CAD", new BigDecimal("0.8"),
                "EUR", new BigDecimal("0.9"),
                "GBP", new BigDecimal("0.7"),
                "AUD", new BigDecimal("1.4"))));
        ExchangeRateService service = service(client);

        assertThat(service.convert(new BigDecimal("10.00"), "CAD", "USD")).isEqualByComparingTo("12.50");
        assertThat(service.convert(new BigDecimal("1.02"), "CAD", "USD")).isEqualByComparingTo("1.28");
        assertThat(client.calls()).isEqualTo(1);
        assertThat(client.lastBase).isEqualTo("USD");
    }

    @Test
    void sameCurrencyIsANoOpWithoutCallingTheApi() {
        FakeClient client = new FakeClient();
        ExchangeRateService service = service(client);

        assertThat(service.convert(new BigDecimal("1.01"), "CAD", "CAD")).isEqualByComparingTo("1.01");
        assertThat(client.calls()).isZero();
    }

    @Test
    void validCacheIsReusedAndReportsItsSource() {
        FakeClient client = new FakeClient(response(future(), rates()));
        ExchangeRateService service = service(client);

        ExchangeRateService.RateLookup first = service.latest();
        ExchangeRateService.RateLookup second = service.latest();

        assertThat(first.source()).isEqualTo(ExchangeRateService.RateSource.LIVE);
        assertThat(second.source()).isEqualTo(ExchangeRateService.RateSource.CACHED);
        assertThat(first.asOf()).isEqualTo(Instant.parse("2026-11-04T00:00:00Z"));
        assertThat(client.calls()).isEqualTo(1);
    }

    @Test
    void expiredCacheRefreshesFromApiAndReportsLive() {
        FakeClient client = new FakeClient(
                response(Instant.now().minusSeconds(10), rates()),
                response(future(), rates()));
        ExchangeRateService service = service(client);

        service.latest();
        ExchangeRateService.RateLookup refreshed = service.latest();

        assertThat(refreshed.source()).isEqualTo(ExchangeRateService.RateSource.LIVE);
        assertThat(refreshed.asOf()).isEqualTo(Instant.parse("2026-11-04T00:00:00Z"));
        assertThat(client.calls()).isEqualTo(2);
    }

    @Test
    void apiFailureUsesExpiredPreviousRatesAsStale() {
        FakeClient client = new FakeClient(response(Instant.now().minusSeconds(10), rates()));
        ExchangeRateService service = service(client);
        service.latest();
        client.fail = true;

        ExchangeRateService.RateLookup stale = service.latest();

        assertThat(stale.source()).isEqualTo(ExchangeRateService.RateSource.STALE);
        assertThat(stale.asOf()).isEqualTo(Instant.parse("2026-11-04T00:00:00Z"));
        assertThat(client.calls()).isEqualTo(2);
    }

    @Test
    void apiFailureWithoutPreviousRatesUsesBundledSnapshot() {
        FakeClient client = new FakeClient();
        client.fail = true;
        ExchangeRateService service = service(client);

        ExchangeRateService.RateLookup fallback = service.latest();

        assertThat(fallback.source()).isEqualTo(ExchangeRateService.RateSource.FALLBACK);
        assertThat(fallback.rates().baseCurrency()).isEqualTo("USD");
        assertThat(fallback.rates().rates().keySet()).containsAll(SUPPORTED);
        assertThat(client.calls()).isEqualTo(1);
    }

    @Test
    void fallbackModeNeverCallsHttpClient() {
        FakeClient client = new FakeClient();
        ExchangeRateService service = service(client, "fallback", SUPPORTED, snapshotLocation());

        assertThat(service.latest().source()).isEqualTo(ExchangeRateService.RateSource.FALLBACK);
        assertThat(client.calls()).isZero();
    }

    @Test
    void startupVerifiesSupportedCurrenciesExistInSnapshot(@TempDir Path tempDir) throws IOException {
        assertThat(service(new FakeClient()).latest().rates().rates().keySet()).containsAll(SUPPORTED);

        String incompleteSnapshot;
        try (var input = getClass().getClassLoader().getResourceAsStream("exchange-rates-fallback.json")) {
            incompleteSnapshot = new String(input.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8)
                    .replaceAll("(?m)^\\s*\"JPY\":[^\\r\\n]*\\R", "");
        }
        Path snapshotFile = tempDir.resolve("rates-missing-jpy.json");
        Files.writeString(snapshotFile, incompleteSnapshot);

        assertThatThrownBy(() -> service(
                        new FakeClient(), "live", List.of("CAD", "JPY"), snapshotFile.toUri().toString()))
                .isInstanceOf(IllegalStateException.class)
                .hasRootCauseMessage("Exchange-rate data is missing supported currencies: JPY");
    }

    @Test
    void returnsCleanUnavailableErrorWhenEveryRateSourceFails(@TempDir Path tempDir) throws IOException {
        Path snapshotFile = tempDir.resolve("rates.json");
        try (var input = getClass().getClassLoader().getResourceAsStream("exchange-rates-fallback.json")) {
            Files.copy(input, snapshotFile);
        }
        FakeClient client = new FakeClient();
        client.fail = true;
        ExchangeRateService service = service(client, "live", SUPPORTED, snapshotFile.toUri().toString());
        Files.delete(snapshotFile);

        assertThatThrownBy(service::latest)
                .isInstanceOf(ExchangeRateUnavailableException.class)
                .hasMessage("Exchange rates are currently unavailable. Please try again shortly.");
    }

    private static ExchangeRateService service(FakeClient client) {
        return service(client, "live", SUPPORTED, snapshotLocation());
    }

    private static ExchangeRateService service(
            FakeClient client, String source, List<String> supported, String snapshotLocation) {
        return new ExchangeRateService(
                client,
                "https://rates.example/latest",
                source,
                supported,
                snapshotLocation,
                new DefaultResourceLoader(),
                JsonMapper.builder().build());
    }

    private static String snapshotLocation() {
        return "classpath:exchange-rates-fallback.json";
    }

    private static Instant future() {
        return Instant.now().plusSeconds(86_400);
    }

    private static Map<String, BigDecimal> rates() {
        return Map.of(
                "USD", BigDecimal.ONE,
                "CAD", new BigDecimal("0.8"),
                "EUR", new BigDecimal("0.9"),
                "GBP", new BigDecimal("0.7"),
                "AUD", new BigDecimal("1.4"));
    }

    private static ExchangeRateResponse response(Instant nextUpdate, Map<String, BigDecimal> rates) {
        Instant asOf = Instant.parse("2026-11-04T00:00:00Z");
        return new ExchangeRateResponse(
                "success",
                asOf.getEpochSecond(),
                DateTimeFormatter.RFC_1123_DATE_TIME.format(asOf.atZone(ZoneOffset.UTC)),
                nextUpdate.getEpochSecond(),
                DateTimeFormatter.RFC_1123_DATE_TIME.format(nextUpdate.atZone(ZoneOffset.UTC)),
                "USD",
                rates);
    }

    private static final class FakeClient implements ExchangeRateHttpClient {

        private final AtomicInteger calls = new AtomicInteger();
        private final Queue<ExchangeRateResponse> responses = new ArrayDeque<>();
        private boolean fail;
        private String lastBase;

        private FakeClient(ExchangeRateResponse... responses) {
            this.responses.addAll(List.of(responses));
        }

        @Override
        public ExchangeRateResponse fetch(String baseUrl, String baseCurrency) {
            calls.incrementAndGet();
            lastBase = baseCurrency;
            if (fail || responses.isEmpty()) {
                throw new IllegalStateException("test outage");
            }
            return responses.remove();
        }

        int calls() {
            return calls.get();
        }
    }
}
