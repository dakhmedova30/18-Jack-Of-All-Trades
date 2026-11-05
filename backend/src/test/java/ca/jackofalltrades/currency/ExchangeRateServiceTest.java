package ca.jackofalltrades.currency;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class ExchangeRateServiceTest {

    @Test
    void convertsKnownRatesAndRoundsHalfUp() {
        FakeClient client = new FakeClient(Instant.parse("2026-11-02T00:00:00Z").getEpochSecond());
        ExchangeRateService service = new ExchangeRateService(client, "https://rates.example/latest");

        assertThat(service.convert(new BigDecimal("10.00"), "CAD", "USD")).isEqualByComparingTo("12.50");
        assertThat(service.convert(new BigDecimal("1.02"), "CAD", "USD")).isEqualByComparingTo("1.28");
    }

    @Test
    void sameCurrencyIsANoOpWithoutCallingTheApi() {
        FakeClient client = new FakeClient();
        ExchangeRateService service = new ExchangeRateService(client, "https://rates.example/latest");

        assertThat(service.convert(new BigDecimal("1.01"), "CAD", "CAD")).isEqualByComparingTo("1.01");
        assertThat(client.calls()).isZero();
    }

    @Test
    void rejectsUnknownCurrencyCodesBeforeCallingTheApi() {
        FakeClient client = new FakeClient();
        ExchangeRateService service = new ExchangeRateService(client, "https://rates.example/latest");

        assertThatThrownBy(() -> service.convert(BigDecimal.ONE, "ZZZ", "USD"))
                .isInstanceOf(ca.jackofalltrades.common.api.BadRequestException.class)
                .hasMessageContaining("not supported");
        assertThat(client.calls()).isZero();
    }

    @Test
    void restrictsConversionCurrenciesToTheSupportedList() {
        assertThat(ExchangeRateService.validateConversionCurrency("cad")).isEqualTo("CAD");
        assertThat(ExchangeRateService.validateConversionCurrency("USD")).isEqualTo("USD");
        assertThat(ExchangeRateService.validateConversionCurrency("EUR")).isEqualTo("EUR");
        assertThat(ExchangeRateService.validateConversionCurrency("GBP")).isEqualTo("GBP");
        assertThat(ExchangeRateService.validateConversionCurrency("AUD")).isEqualTo("AUD");

        assertThatThrownBy(() -> ExchangeRateService.validateConversionCurrency("JPY"))
                .isInstanceOf(ca.jackofalltrades.common.api.BadRequestException.class)
                .hasMessageContaining("CAD, USD, EUR, GBP, and AUD");
    }

    @Test
    void reusesCachedRatesUntilTheirRefreshTime() {
        FakeClient client = new FakeClient();
        ExchangeRateService service = new ExchangeRateService(client, "https://rates.example/latest");

        service.latest("CAD");
        service.latest("CAD");

        assertThat(client.calls()).isEqualTo(1);
    }

    @Test
    void usesStaleRatesAfterRefreshFailureAndKeepsTheRateDate() {
        FakeClient client = new FakeClient(Instant.parse("2026-11-02T00:00:00Z").getEpochSecond());
        ExchangeRateService service = new ExchangeRateService(client, "https://rates.example/latest");
        service.latest("CAD");
        client.fail = true;

        ExchangeRates stale = service.latest("CAD");

        assertThat(stale.asOfDate()).isEqualTo(Instant.parse("2026-11-01T00:00:00Z")
                .atZone(java.time.ZoneOffset.UTC).toLocalDate());
    }

    private static ExchangeRateResponse response(String base, BigDecimal usdRate, long nextUpdate) {
        return new ExchangeRateResponse(
                "success",
                nextUpdate - 86_400L,
                nextUpdate,
                base,
                base.equals("CAD")
                        ? Map.of("CAD", BigDecimal.ONE, "USD", usdRate)
                        : Map.of("CAD", BigDecimal.ONE.divide(usdRate, 8,
                                java.math.RoundingMode.HALF_UP), "USD", BigDecimal.ONE));
    }

    private static final class FakeClient implements ExchangeRateHttpClient {

        private final AtomicInteger calls = new AtomicInteger();
        private boolean fail;
        private final long nextUpdate;

        private FakeClient() {
            this(4_102_444_800L);
        }

        private FakeClient(long nextUpdate) {
            this.nextUpdate = nextUpdate;
        }

        @Override
        public ExchangeRateResponse fetch(String baseUrl, String baseCurrency) {
            calls.incrementAndGet();
            if (fail) {
                throw new IllegalStateException("test outage");
            }
            return response(baseCurrency, new BigDecimal("1.25"), nextUpdate);
        }

        int calls() {
            return calls.get();
        }
    }
}
