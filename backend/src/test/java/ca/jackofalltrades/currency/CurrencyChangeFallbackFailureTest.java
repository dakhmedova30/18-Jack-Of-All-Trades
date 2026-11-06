package ca.jackofalltrades.currency;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ca.jackofalltrades.PostgresTestBase;
import jakarta.servlet.http.Cookie;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@Import(CurrencyChangeFallbackFailureTest.FailingRatesConfiguration.class)
class CurrencyChangeFallbackFailureTest extends PostgresTestBase {

    private static final Path SNAPSHOT_FILE = createSnapshotFile();

    @Autowired
    private JdbcClient jdbc;

    @Autowired
    private FailingRates client;

    @DynamicPropertySource
    static void currencyProperties(DynamicPropertyRegistry registry) {
        registry.add("exchange.rates.snapshot-location", () -> SNAPSHOT_FILE.toUri().toString());
    }

    @AfterAll
    static void removeSnapshotFixture() throws IOException {
        Files.deleteIfExists(SNAPSHOT_FILE);
    }

    @Test
    void allSourcesFailWithCleanErrorAndDoNotModifyPrices() throws Exception {
        Cookie cookie = registerAndLogin();
        int businessId = businessId(cookie);
        int itemId = jdbc.sql("""
                        INSERT INTO items (business_id, name, quantity, unit_price_cents)
                        VALUES (:business, 'Unchanged', 3, 1250) RETURNING id
                        """)
                .param("business", businessId)
                .query(Integer.class)
                .single();

        Files.delete(SNAPSHOT_FILE);
        client.fail.set(true);

        mockMvc.perform(post("/api/auth/me/currency")
                        .cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currency\":\"USD\",\"convertPrices\":true}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error.message").value(
                        "Exchange rates are currently unavailable. Please try again shortly."))
                .andExpect(jsonPath("$.trace").doesNotExist());

        assertThat(jdbc.sql("SELECT currency FROM businesses WHERE id = :id")
                .param("id", businessId).query(String.class).single()).isEqualTo("CAD");
        assertThat(jdbc.sql("SELECT unit_price_cents FROM items WHERE id = :id")
                .param("id", itemId).query(Integer.class).single()).isEqualTo(1250);
    }

    private static Path createSnapshotFile() {
        try {
            Path file = Files.createTempFile("exchange-rates-fallback-", ".json");
            try (var input = CurrencyChangeFallbackFailureTest.class.getClassLoader()
                    .getResourceAsStream("exchange-rates-fallback.json")) {
                Files.copy(input, file, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            }
            return file;
        } catch (IOException error) {
            throw new ExceptionInInitializerError(error);
        }
    }

    @TestConfiguration
    static class FailingRatesConfiguration {

        @Bean
        @Primary
        FailingRates failingRates() {
            return new FailingRates();
        }
    }

    static class FailingRates implements ExchangeRateHttpClient {

        private final AtomicBoolean fail = new AtomicBoolean();

        @Override
        public ExchangeRateResponse fetch(String baseUrl, String baseCurrency) {
            if (fail.get()) {
                throw new IllegalStateException("test API outage");
            }
            throw new IllegalStateException("unexpected API request before failure setup");
        }
    }
}
