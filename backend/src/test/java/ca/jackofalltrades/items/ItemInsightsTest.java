package ca.jackofalltrades.items;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ca.jackofalltrades.PostgresTestBase;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;

/** Contract §3: GET /api/items/insights and GET /api/items/low-stock. */
class ItemInsightsTest extends PostgresTestBase {

    @Autowired
    private JdbcClient jdbcClient;

    private int insertItem(int businessId, String name, int quantity, int priceCents) {
        return jdbcClient.sql("""
                        INSERT INTO items (business_id, name, quantity, unit_price_cents)
                        VALUES (:b, :name, :quantity, :price) RETURNING id
                        """)
                .param("b", businessId).param("name", name).param("quantity", quantity).param("price", priceCents)
                .query(Integer.class).single();
    }

    /** Inserts a one-line sale directly, so stock is untouched and soldAt can be any time. */
    private void insertSale(int businessId, Instant soldAt, int itemId, String name, int quantity, int priceCents) {
        int channel = jdbcClient.sql("SELECT id FROM channels WHERE business_id = :b ORDER BY id LIMIT 1")
                .param("b", businessId).query(Integer.class).single();
        int saleId = jdbcClient.sql("""
                        INSERT INTO sales (business_id, sold_at, channel_id) VALUES (:b, :soldAt, :c) RETURNING id
                        """)
                .param("b", businessId).param("soldAt", OffsetDateTime.ofInstant(soldAt, ZoneOffset.UTC))
                .param("c", channel)
                .query(Integer.class).single();
        jdbcClient.sql("""
                        INSERT INTO sale_items (sale_id, item_id, item_name, quantity, unit_price_cents, total_cents)
                        VALUES (:s, :i, :name, :q, :p, :t)
                        """)
                .param("s", saleId).param("i", itemId).param("name", name).param("q", quantity)
                .param("p", priceCents).param("t", quantity * priceCents)
                .update();
    }

    private static Instant startOfThisMonth() {
        return LocalDate.now(ZoneOffset.UTC).withDayOfMonth(1).atStartOfDay(ZoneOffset.UTC).toInstant();
    }

    // ---- GET /api/items/insights ----

    @Test
    void insightsRequireLogin() throws Exception {
        mockMvc.perform(get("/api/items/insights")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/items/low-stock")).andExpect(status().isUnauthorized());
    }

    @Test
    void emptyInventoryHasZeroInsights() throws Exception {
        Cookie cookie = registerAndLogin();
        Instant start = startOfThisMonth();
        Instant end = start.atOffset(ZoneOffset.UTC).plusMonths(1).toInstant();

        mockMvc.perform(get("/api/items/insights").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stockValueCents").value(0))
                .andExpect(jsonPath("$.totalUnits").value(0))
                .andExpect(jsonPath("$.periodStart").value(start.toString()))
                .andExpect(jsonPath("$.periodEnd").value(end.toString()))
                .andExpect(jsonPath("$.bestSellers").isEmpty());
    }

    @Test
    void stockValueIsQuantityTimesSellingPrice() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        insertItem(business, "Flower Print", 10, 1200);
        insertItem(business, "Keychain", 3, 800);
        insertItem(business, "Sold Out", 0, 5000);
        insertItem(businessId(registerAndLogin()), "Someone Else's", 100, 100);

        mockMvc.perform(get("/api/items/insights").cookie(cookie))
                .andExpect(jsonPath("$.stockValueCents").value(10 * 1200 + 3 * 800))
                .andExpect(jsonPath("$.totalUnits").value(13));
    }

    @Test
    void bestSellersAreThisMonthsTopThreeByUnits() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        Instant thisMonth = startOfThisMonth().plusSeconds(60);
        Instant lastMonth = startOfThisMonth().minusSeconds(60);
        int print = insertItem(business, "Print", 10, 1000);
        int keychain = insertItem(business, "Keychain", 10, 500);
        int sticker = insertItem(business, "Sticker", 10, 100);
        int tote = insertItem(business, "Tote", 10, 2000);
        int deleted = insertItem(business, "Deleted", 10, 100);

        insertSale(business, thisMonth, print, "Print", 2, 1000);
        insertSale(business, thisMonth, print, "Print", 3, 1000);
        insertSale(business, thisMonth, sticker, "Sticker", 9, 100);
        insertSale(business, thisMonth, keychain, "Keychain", 5, 500);
        insertSale(business, thisMonth, tote, "Tote", 1, 2000);
        insertSale(business, lastMonth, tote, "Tote", 50, 2000);
        insertSale(business, thisMonth, deleted, "Deleted", 99, 100);
        jdbcClient.sql("DELETE FROM items WHERE id = :id").param("id", deleted).update();

        // Sticker leads on units; Print and Keychain tie on 5 units, so revenue breaks the tie.
        mockMvc.perform(get("/api/items/insights").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bestSellers", hasSize(3)))
                .andExpect(jsonPath("$.bestSellers[*].name", contains("Sticker", "Print", "Keychain")))
                .andExpect(jsonPath("$.bestSellers[0].id").value(sticker))
                .andExpect(jsonPath("$.bestSellers[0].unitsSold").value(9))
                .andExpect(jsonPath("$.bestSellers[0].revenueCents").value(900))
                .andExpect(jsonPath("$.bestSellers[1].unitsSold").value(5))
                .andExpect(jsonPath("$.bestSellers[1].revenueCents").value(5000));
    }

    @Test
    void bestSellersIgnoreOtherBusinesses() throws Exception {
        Cookie cookie = registerAndLogin();
        Cookie other = registerAndLogin();
        int otherBusiness = businessId(other);
        int othersItem = insertItem(otherBusiness, "Not Yours", 10, 100);
        insertSale(otherBusiness, startOfThisMonth().plusSeconds(60), othersItem, "Not Yours", 4, 100);

        mockMvc.perform(get("/api/items/insights").cookie(cookie))
                .andExpect(jsonPath("$.bestSellers").isEmpty());
    }

    @Test
    void insightsIsNotParsedAsAnId() throws Exception {
        Cookie cookie = registerAndLogin();

        mockMvc.perform(get("/api/items/low-stock").cookie(cookie)).andExpect(status().isOk());
        mockMvc.perform(get("/api/items/insights").cookie(cookie)).andExpect(status().isOk());
    }

    // ---- GET /api/items/low-stock ----

    @Test
    void lowStockCountsEveryLowItemButListsUpToTheLimit() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        insertItem(business, "Five", 5, 100);
        insertItem(business, "Zero", 0, 100);
        insertItem(business, "Six", 6, 100);
        insertItem(business, "Two B", 2, 100);
        insertItem(business, "Two A", 2, 100);
        insertItem(businessId(registerAndLogin()), "Someone Else's", 0, 100);

        mockMvc.perform(get("/api/items/low-stock").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(4))
                .andExpect(jsonPath("$.threshold").value(5))
                .andExpect(jsonPath("$.items[*].name", contains("Zero", "Two A", "Two B", "Five")))
                .andExpect(jsonPath("$.items[0].id").isNumber())
                .andExpect(jsonPath("$.items[0].quantity").value(0));

        mockMvc.perform(get("/api/items/low-stock?limit=2").cookie(cookie))
                .andExpect(jsonPath("$.count").value(4))
                .andExpect(jsonPath("$.items[*].name", contains("Zero", "Two A")));
    }

    @Test
    void lowStockLimitIsValidated() throws Exception {
        Cookie cookie = registerAndLogin();

        mockMvc.perform(get("/api/items/low-stock?limit=0").cookie(cookie))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].field").value("limit"));
        mockMvc.perform(get("/api/items/low-stock?limit=101").cookie(cookie))
                .andExpect(status().isBadRequest());
    }
}
