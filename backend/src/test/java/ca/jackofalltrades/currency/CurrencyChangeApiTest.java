package ca.jackofalltrades.currency;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ca.jackofalltrades.PostgresTestBase;
import jakarta.servlet.http.Cookie;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;

@Import(CurrencyChangeApiTest.TestRatesConfiguration.class)
class CurrencyChangeApiTest extends PostgresTestBase {

    @Autowired
    private JdbcClient jdbc;

    @Autowired
    private ControlledRates rates;

    @Test
    void convertPricesFalseRelabelsCurrenciesWithoutChangingAmounts() throws Exception {
        int callsBefore = rates.calls;
        Cookie cookie = registerAndLogin();
        int businessId = businessId(cookie);
        int itemId = insertItem(businessId);
        int channelId = jdbc.sql("SELECT id FROM channels WHERE business_id = :business AND name = 'Online'")
                .param("business", businessId).query(Integer.class).single();
        int saleId = jdbc.sql("""
                        INSERT INTO sales (business_id, sold_at, channel_id)
                        VALUES (:business, now(), :channel) RETURNING id
                        """)
                .param("business", businessId).param("channel", channelId).query(Integer.class).single();
        jdbc.sql("""
                        INSERT INTO sale_items (sale_id, item_id, item_name, quantity, unit_price_cents, total_cents)
                        VALUES (:sale, :item, 'Test item', 1, 1250, 1250)
                        """)
                .param("sale", saleId).param("item", itemId).update();
        int expenseId = jdbc.sql("""
                        INSERT INTO expenses (business_id, incurred_at) VALUES (:business, now()) RETURNING id
                        """)
                .param("business", businessId).query(Integer.class).single();
        jdbc.sql("""
                        INSERT INTO expense_items (expense_id, item_id, item_name, quantity, unit_cost_cents, total_cents)
                        VALUES (:expense, :item, 'Test item', 1, 850, 850)
                        """)
                .param("expense", expenseId).param("item", itemId).update();

        mockMvc.perform(post("/api/auth/me/currency")
                        .cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currency\":\"USD\",\"convertPrices\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.business.currency").value("USD"))
                .andExpect(jsonPath("$.rate").value(org.hamcrest.Matchers.nullValue()));

        assertThat(jdbc.sql("SELECT unit_price_cents FROM items WHERE id = :id")
                .param("id", itemId).query(Integer.class).single()).isEqualTo(1250);
        assertThat(jdbc.sql("SELECT currency FROM items WHERE id = :id")
                .param("id", itemId).query(String.class).single()).isEqualTo("USD");
        assertThat(jdbc.sql("SELECT original_price FROM items WHERE id = :id")
                .param("id", itemId).query(BigDecimal.class).single()).isEqualByComparingTo("12.50");
        assertThat(jdbc.sql("SELECT total_cents FROM sale_items WHERE sale_id = :id")
                .param("id", saleId).query(Integer.class).single()).isEqualTo(1250);
        assertThat(jdbc.sql("SELECT original_amount FROM sales WHERE id = :id")
                .param("id", saleId).query(BigDecimal.class).single()).isEqualByComparingTo("12.50");
        assertThat(jdbc.sql("SELECT currency FROM sales WHERE id = :id")
                .param("id", saleId).query(String.class).single()).isEqualTo("USD");
        assertThat(jdbc.sql("SELECT total_cents FROM expense_items WHERE expense_id = :id")
                .param("id", expenseId).query(Integer.class).single()).isEqualTo(850);
        assertThat(jdbc.sql("SELECT original_amount FROM expenses WHERE id = :id")
                .param("id", expenseId).query(BigDecimal.class).single()).isEqualByComparingTo("8.50");
        assertThat(rates.calls).isEqualTo(callsBefore);
    }

    @Test
    @DirtiesContext(methodMode = DirtiesContext.MethodMode.BEFORE_METHOD)
    void exchangeFailureUsesBundledFallbackRatesForConversion() throws Exception {
        Cookie cookie = registerAndLogin();
        int businessId = businessId(cookie);
        int itemId = insertItem(businessId);
        rates.fail = true;

        try {
            mockMvc.perform(post("/api/auth/me/currency")
                            .cookie(cookie)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"currency\":\"USD\",\"convertPrices\":true}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.business.currency").value("USD"))
                    .andExpect(jsonPath("$.source").value("FALLBACK"))
                    .andExpect(jsonPath("$.asOf").isNotEmpty())
                    .andExpect(jsonPath("$.notice").value(
                            org.hamcrest.Matchers.containsString("Live exchange rates couldn't be loaded")));
        } finally {
            rates.fail = false;
        }

        assertThat(jdbc.sql("SELECT currency FROM businesses WHERE id = :id")
                .param("id", businessId).query(String.class).single()).isEqualTo("USD");
        assertThat(jdbc.sql("SELECT unit_price_cents FROM items WHERE id = :id")
                .param("id", itemId).query(Integer.class).single()).isNotEqualTo(1250);
        assertThat(jdbc.sql("SELECT currency FROM items WHERE id = :id")
                .param("id", itemId).query(String.class).single()).isEqualTo("USD");
    }

    @Test
    @DirtiesContext(methodMode = DirtiesContext.MethodMode.BEFORE_METHOD)
    void fallbackPreviewHasInformationalNotice() throws Exception {
        Cookie cookie = registerAndLogin();
        int businessId = businessId(cookie);
        insertItem(businessId);
        rates.fail = true;

        try {
            mockMvc.perform(post("/api/auth/me/currency/preview")
                            .cookie(cookie)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"currency\":\"USD\",\"convertPrices\":true}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.source").value("FALLBACK"))
                    .andExpect(jsonPath("$.asOf").isNotEmpty())
                    .andExpect(jsonPath("$.notice").value(
                            org.hamcrest.Matchers.containsString("Live exchange rates couldn't be loaded")));
        } finally {
            rates.fail = false;
        }
    }

    @Test
    void previewShowsSampleConversionAndLeavesDataUntouched() throws Exception {
        Cookie cookie = registerAndLogin();
        int businessId = businessId(cookie);
        int itemId = insertItem(businessId);

        mockMvc.perform(post("/api/auth/me/currency/preview")
                        .cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currency\":\"USD\",\"convertPrices\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.productsAffected").value(1))
                .andExpect(jsonPath("$.samples[0].beforePrice").value(12.5))
                .andExpect(jsonPath("$.samples[0].afterPrice").value(15.63))
                .andExpect(jsonPath("$.rate").value(1.25))
                .andExpect(jsonPath("$.source").value("CACHED"))
                .andExpect(jsonPath("$.asOf").isNotEmpty());

        assertThat(jdbc.sql("SELECT unit_price_cents FROM items WHERE id = :id")
                .param("id", itemId).query(Integer.class).single()).isEqualTo(1250);
    }

    @Test
    void rejectsCurrenciesOutsideTheSupportedConversionList() throws Exception {
        Cookie cookie = registerAndLogin();

        mockMvc.perform(post("/api/auth/me/currency/preview")
                        .cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currency\":\"JPY\",\"convertPrices\":true}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value(
                        "Currency must be one of: CAD, USD, EUR, GBP, AUD"));
    }

    @Test
    void convertsProductsAndConvertsHistoricalTotalsAtReadTime() throws Exception {
        Cookie cookie = registerAndLogin();
        int businessId = businessId(cookie);
        int itemId = insertItem(businessId);
        int channelId = jdbc.sql("SELECT id FROM channels WHERE business_id = :business AND name = 'Online'")
                .param("business", businessId).query(Integer.class).single();
        int saleId = jdbc.sql("""
                        INSERT INTO sales (business_id, sold_at, channel_id)
                        VALUES (:business, now(), :channel) RETURNING id
                        """)
                .param("business", businessId).param("channel", channelId).query(Integer.class).single();
        jdbc.sql("""
                        INSERT INTO sale_items (sale_id, item_id, item_name, quantity, unit_price_cents, total_cents)
                        VALUES (:sale, :item, 'Test item', 1, 1250, 1250)
                        """)
                .param("sale", saleId).param("item", itemId).update();
        int expenseId = jdbc.sql("""
                        INSERT INTO expenses (business_id, incurred_at) VALUES (:business, now()) RETURNING id
                        """)
                .param("business", businessId).query(Integer.class).single();
        jdbc.sql("""
                        INSERT INTO expense_items (expense_id, item_id, item_name, quantity, unit_cost_cents, total_cents)
                        VALUES (:expense, :item, 'Test item', 1, 850, 850)
                        """)
                .param("expense", expenseId).param("item", itemId).update();

        mockMvc.perform(post("/api/auth/me/currency")
                        .cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currency\":\"USD\",\"convertPrices\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.business.currency").value("USD"))
                .andExpect(jsonPath("$.rate").value(1.25));

        assertThat(jdbc.sql("SELECT unit_price_cents FROM items WHERE id = :id")
                .param("id", itemId).query(Integer.class).single()).isEqualTo(1563);
        assertThat(jdbc.sql("SELECT currency FROM sales WHERE id = :id")
                .param("id", saleId).query(String.class).single()).isEqualTo("CAD");
        mockMvc.perform(get("/api/sales").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].totalCents").value(1563))
                .andExpect(jsonPath("$.data[0].currency").value("USD"));
        mockMvc.perform(get("/api/expenses").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].totalCents").value(1063))
                .andExpect(jsonPath("$.data[0].currency").value("USD"));
        mockMvc.perform(get("/api/sales/month-summary").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.revenueCents").value(1563))
                .andExpect(jsonPath("$.largestSale.totalCents").value(1563));
        mockMvc.perform(get("/api/expenses/month-breakdown").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.restockCents").value(1063))
                .andExpect(jsonPath("$.totalCents").value(1063));
        mockMvc.perform(get("/api/analytics/summary?range=month").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalRevenueCents").value(1563))
                .andExpect(jsonPath("$.totalExpensesCents").value(1063))
                .andExpect(jsonPath("$.revenueByChannel[0].label").value("Online"))
                .andExpect(jsonPath("$.revenueByChannel[0].valueCents").value(1563));
    }

    @Test
    void rejectsAConversionThatWouldPutAPriceOverTheLimit() throws Exception {
        Cookie cookie = registerAndLogin();
        int businessId = businessId(cookie);
        // 9,000,000.00 CAD is allowed, but CAD to AUD multiplies by 1.75 at the test rates.
        int itemId = jdbc.sql("""
                        INSERT INTO items (business_id, name, quantity, unit_price_cents)
                        VALUES (:business, 'Gold ring', 1, 900000000) RETURNING id
                        """)
                .param("business", businessId).query(Integer.class).single();

        mockMvc.perform(post("/api/auth/me/currency")
                        .cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currency\":\"AUD\",\"convertPrices\":true}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value(
                        "Converting would put \"Gold ring\" over the 9,999,999.99 price limit."
                                + " Lower its price first, or re-label instead."));

        // Nothing changed: the price, the item's currency and the account's currency.
        assertThat(jdbc.sql("SELECT unit_price_cents FROM items WHERE id = :id")
                .param("id", itemId).query(Integer.class).single()).isEqualTo(900000000);
        assertThat(jdbc.sql("SELECT currency FROM businesses WHERE id = :id")
                .param("id", businessId).query(String.class).single()).isEqualTo("CAD");
    }

    private int insertItem(int businessId) {
        return jdbc.sql("""
                        INSERT INTO items (business_id, name, quantity, unit_price_cents)
                        VALUES (:business, 'Test item', 4, 1250) RETURNING id
                        """)
                .param("business", businessId).query(Integer.class).single();
    }

    @TestConfiguration
    static class TestRatesConfiguration {

        @Bean
        @Primary
        ControlledRates controlledRates() {
            return new ControlledRates();
        }
    }

    static class ControlledRates implements ExchangeRateHttpClient {

        private int calls;
        private boolean fail;

        @Override
        public ExchangeRateResponse fetch(String baseUrl, String baseCurrency) {
            calls++;
            if (fail) {
                throw new IllegalStateException("test exchange-rate outage");
            }
            return new ExchangeRateResponse(
                    "success",
                    Instant.parse("2026-11-01T00:00:00Z").getEpochSecond(),
                    Instant.parse("2100-01-01T00:00:00Z").getEpochSecond(),
                    "USD",
                    Map.of(
                            "USD", BigDecimal.ONE,
                            "CAD", new BigDecimal("0.80"),
                            "EUR", new BigDecimal("0.90"),
                            "GBP", new BigDecimal("0.70"),
                            "AUD", new BigDecimal("1.40")));
        }
    }
}
