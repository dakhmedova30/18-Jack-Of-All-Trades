package ca.jackofalltrades.analytics;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ca.jackofalltrades.PostgresTestBase;
import jakarta.servlet.http.Cookie;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;

/**
 * Contract §6: GET /api/analytics/summary and /inventory. Dates are relative to the real clock;
 * "now" always falls in the last bucket, and the other dates stay well clear of bucket edges.
 */
class AnalyticsControllerTest extends PostgresTestBase {

    @Autowired
    private JdbcClient jdbcClient;

    /** A sale with one line of {@code totalCents}, tagged {@code tags} (first tag counts). */
    private void insertSale(int businessId, Instant soldAt, long totalCents, String... tags) {
        int saleId = jdbcClient.sql("""
                        INSERT INTO sales (business_id, sold_at, channel_id, tags)
                        VALUES (:b, :at, (SELECT MIN(id) FROM channels WHERE business_id = :b), :tags) RETURNING id
                        """)
                .param("b", businessId).param("at", OffsetDateTime.ofInstant(soldAt, ZoneOffset.UTC)).param("tags", tags)
                .query(Integer.class).single();
        jdbcClient.sql("""
                        INSERT INTO sale_items (sale_id, item_name, quantity, unit_price_cents, total_cents)
                        VALUES (:sale, 'Thing', 1, :total, :total)
                        """)
                .param("sale", saleId).param("total", totalCents).update();
    }

    private void insertExpense(int businessId, Instant incurredAt, long totalCents, String... tags) {
        int expenseId = jdbcClient.sql("""
                        INSERT INTO expenses (business_id, incurred_at, tags) VALUES (:b, :at, :tags) RETURNING id
                        """)
                .param("b", businessId).param("at", OffsetDateTime.ofInstant(incurredAt, ZoneOffset.UTC))
                .param("tags", tags)
                .query(Integer.class).single();
        jdbcClient.sql("""
                        INSERT INTO expense_items (expense_id, item_name, quantity, unit_cost_cents, total_cents)
                        VALUES (:expense, 'Cost', 1, :total, :total)
                        """)
                .param("expense", expenseId).param("total", totalCents).update();
    }

    private void insertItem(int businessId, int quantity, String... tags) {
        jdbcClient.sql("""
                        INSERT INTO items (business_id, name, quantity, unit_price_cents, tags)
                        VALUES (:b, 'Item', :quantity, 100, :tags)
                        """)
                .param("b", businessId).param("quantity", quantity).param("tags", tags).update();
    }

    @Test
    void requiresLogin() throws Exception {
        mockMvc.perform(get("/api/analytics/summary")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/analytics/inventory")).andExpect(status().isUnauthorized());
    }

    @Test
    void invalidRangeIsAValidationError() throws Exception {
        Cookie cookie = registerAndLogin();

        mockMvc.perform(get("/api/analytics/summary?range=decade").cookie(cookie))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].field").value("range"));
    }

    @Test
    void noDataStillHasBucketsButNoSeries() throws Exception {
        Cookie cookie = registerAndLogin();

        mockMvc.perform(get("/api/analytics/summary").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.range").value("12months"))
                .andExpect(jsonPath("$.granularity").value("month"))
                .andExpect(jsonPath("$.buckets", hasSize(12)))
                .andExpect(jsonPath("$.bucketLabels", hasSize(12)))
                .andExpect(jsonPath("$.totalRevenueCents").value(0))
                .andExpect(jsonPath("$.totalExpensesCents").value(0))
                .andExpect(jsonPath("$.netProfitCents").value(0))
                .andExpect(jsonPath("$.revenueSeries").isEmpty())
                .andExpect(jsonPath("$.expenseSeries").isEmpty())
                .andExpect(jsonPath("$.salesByTag").isEmpty());
        mockMvc.perform(get("/api/analytics/summary?range=week").cookie(cookie))
                .andExpect(jsonPath("$.granularity").value("day"))
                .andExpect(jsonPath("$.buckets", hasSize(7)));
    }

    @Test
    void groupsByFirstTagIntoTopThreePlusOther() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        Instant now = Instant.now();
        insertSale(business, now, 400, "print", "ignored-second-tag");
        insertSale(business, now, 300, "keychain");
        insertSale(business, now, 200, "sticker");
        insertSale(business, now, 100, "pin");
        insertSale(business, now, 50);                       // untagged
        insertExpense(business, now, 1000, "supplies");
        insertExpense(business, now, 200);

        mockMvc.perform(get("/api/analytics/summary").cookie(cookie))
                .andExpect(jsonPath("$.totalRevenueCents").value(1050))
                .andExpect(jsonPath("$.totalExpensesCents").value(1200))
                .andExpect(jsonPath("$.netProfitCents").value(-150))
                .andExpect(jsonPath("$.revenueSeries[*].label", contains("print", "keychain", "sticker", "Other")))
                .andExpect(jsonPath("$.revenueSeries[0].values", hasSize(12)))
                .andExpect(jsonPath("$.revenueSeries[0].values[11]").value(400))
                .andExpect(jsonPath("$.revenueSeries[3].values[11]").value(150))   // pin + Untagged
                .andExpect(jsonPath("$.expenseSeries[*].label", contains("supplies", "Untagged")))
                .andExpect(jsonPath("$.salesByTag[*].label", contains("print", "keychain", "sticker", "Other")))
                .andExpect(jsonPath("$.salesByTag[*].valueCents", contains(400, 300, 200, 150)));
    }

    @Test
    void onlyThisBusinessFromTheWindowStartCounts() throws Exception {
        Cookie mine = registerAndLogin();
        Cookie theirs = registerAndLogin();
        int business = businessId(mine);
        Instant now = Instant.now();
        Instant windowStart = AnalyticsWindow.forRange("12months", now).start();
        insertSale(business, now, 100, "print");
        insertSale(business, windowStart.minus(Duration.ofDays(1)), 5000, "old");       // before the window
        insertSale(business, now.plus(Duration.ofDays(400)), 70, "future");            // after the last bucket
        insertSale(businessId(theirs), now, 9999, "theirs");

        // As the demo: a future-dated sale counts in the totals and the tag ranking, but in no bucket.
        mockMvc.perform(get("/api/analytics/summary").cookie(mine))
                .andExpect(jsonPath("$.totalRevenueCents").value(170))
                .andExpect(jsonPath("$.revenueSeries[*].label", contains("print")))
                .andExpect(jsonPath("$.salesByTag[*].label", contains("print", "future")));
    }

    @Test
    void inventoryGroupsStockByFirstTagIntoTopSevenPlusOther() throws Exception {
        Cookie mine = registerAndLogin();
        Cookie theirs = registerAndLogin();
        int business = businessId(mine);
        for (int i = 1; i <= 8; i++) {
            insertItem(business, i * 10, "tag" + i);   // tag8 has the most stock, tag1 the least
        }
        insertItem(business, 5, "tag8");
        insertItem(business, 3);                       // untagged: smallest, folds into Other
        insertItem(businessId(theirs), 1000, "theirs");

        mockMvc.perform(get("/api/analytics/inventory").cookie(mine))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.byTag", hasSize(8)))
                .andExpect(jsonPath("$.byTag[0].label").value("tag8"))
                .andExpect(jsonPath("$.byTag[0].quantity").value(85))
                .andExpect(jsonPath("$.byTag[0].itemCount").value(2))
                .andExpect(jsonPath("$.byTag[*].label",
                        contains("tag8", "tag7", "tag6", "tag5", "tag4", "tag3", "tag2", "Other")))
                .andExpect(jsonPath("$.byTag[7].quantity").value(13))     // tag1 (10) + Untagged (3)
                .andExpect(jsonPath("$.byTag[7].itemCount").value(2))
                .andExpect(jsonPath("$.totalQuantity").value(368))
                .andExpect(jsonPath("$.totalItems").value(10));
    }

    @Test
    void emptyInventory() throws Exception {
        Cookie cookie = registerAndLogin();

        mockMvc.perform(get("/api/analytics/inventory").cookie(cookie))
                .andExpect(jsonPath("$.byTag").isEmpty())
                .andExpect(jsonPath("$.totalQuantity").value(0))
                .andExpect(jsonPath("$.totalItems").value(0));
    }
}
