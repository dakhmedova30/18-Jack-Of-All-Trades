package ca.jackofalltrades.notifications;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ca.jackofalltrades.PostgresTestBase;
import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

/** GET /api/notifications and /api/notifications/settings: the alerts that apply, and what sets them off. */
class NotificationControllerTest extends PostgresTestBase {

    private static final String ALL_ON = """
            {"lowStock": true, "outOfStock": true, "newDevice": true, "noSales": true, "noSalesDays": %d,
             "expenseSpike": true, "expenseSpikePercent": %d}
            """;

    private void saveSettings(Cookie cookie, String json) throws Exception {
        mockMvc.perform(put("/api/notifications/settings").cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isOk());
    }

    private int item(Cookie cookie, String name, int quantity) throws Exception {
        String body = mockMvc.perform(post("/api/items").cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"%s\", \"quantity\": %d, \"unitPriceCents\": 100}".formatted(name, quantity)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    private void sale(Cookie cookie, int itemId, Instant soldAt) throws Exception {
        String channels = mockMvc.perform(get("/api/channels").cookie(cookie)).andReturn().getResponse()
                .getContentAsString();
        int channelId = JsonPath.read(channels, "$[0].id");
        mockMvc.perform(post("/api/sales").cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"soldAt\": \"%s\", \"channelId\": %d, \"items\": [{\"itemId\": %d, \"quantity\": 1}]}"
                                .formatted(soldAt, channelId, itemId)))
                .andExpect(status().isCreated());
    }

    private void expense(Cookie cookie, Instant at, int costCents) throws Exception {
        mockMvc.perform(post("/api/expenses").cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"incurredAt\": \"%s\", \"tags\": [\"supplier\"], \"items\": [{\"itemId\": null, "
                                + "\"description\": \"Wax\", \"quantity\": 1, \"unitCostCents\": %d}]}"
                                .formatted(at, costCents)))
                .andExpect(status().isCreated());
    }

    @Test
    void requiresLogin() throws Exception {
        mockMvc.perform(get("/api/notifications")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/notifications/settings")).andExpect(status().isUnauthorized());
    }

    @Test
    void aNewBusinessHasEverythingOnWithDefaultNumbersAndNoAlerts() throws Exception {
        Cookie cookie = registerAndLogin();

        mockMvc.perform(get("/api/notifications/settings").cookie(cookie))
                .andExpect(jsonPath("$.lowStock").value(true))
                .andExpect(jsonPath("$.noSalesDays").value(3))
                .andExpect(jsonPath("$.expenseSpikePercent").value(20));
        mockMvc.perform(get("/api/notifications").cookie(cookie)).andExpect(jsonPath("$", empty()));
    }

    @Test
    void settingsAreSavedAndTheirNumbersValidated() throws Exception {
        Cookie cookie = registerAndLogin();

        saveSettings(cookie, ALL_ON.formatted(10, 50));
        mockMvc.perform(get("/api/notifications/settings").cookie(cookie))
                .andExpect(jsonPath("$.noSalesDays").value(10))
                .andExpect(jsonPath("$.expenseSpikePercent").value(50));

        for (String bad : new String[] {ALL_ON.formatted(0, 50), ALL_ON.formatted(366, 50),
                ALL_ON.formatted(3, 0), ALL_ON.formatted(3, 1001), "{\"lowStock\": true}"}) {
            mockMvc.perform(put("/api/notifications/settings").cookie(cookie)
                            .contentType(MediaType.APPLICATION_JSON).content(bad))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void lowAndOutOfStockAreSeparateAlertsAndFollowTheThreshold() throws Exception {
        Cookie cookie = registerAndLogin();
        item(cookie, "Empty Jar", 0);
        item(cookie, "Candle", 2);
        item(cookie, "Soap", 4);
        item(cookie, "Plenty", 50);

        mockMvc.perform(get("/api/notifications").cookie(cookie))
                .andExpect(jsonPath("$[?(@.type == 'out-of-stock')].message", hasSize(1)))
                .andExpect(jsonPath("$[?(@.type == 'out-of-stock')].message[0]", containsString("Empty Jar")))
                .andExpect(jsonPath("$[?(@.type == 'low-stock')].message[0]", containsString("Candle (2)")))
                .andExpect(jsonPath("$[?(@.type == 'low-stock')].message[0]", containsString("Soap (4)")))
                .andExpect(jsonPath("$[?(@.type == 'low-stock')].message[0]",
                        org.hamcrest.Matchers.not(containsString("Empty Jar"))));

        // Lowering the threshold to 1 drops Candle (2) and Soap (4); the empty jar is still out of stock.
        mockMvc.perform(patch("/api/auth/me").cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lowStockThreshold\": 1}"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/notifications").cookie(cookie))
                .andExpect(jsonPath("$[?(@.type == 'low-stock')]", empty()))
                .andExpect(jsonPath("$[?(@.type == 'out-of-stock')]", hasSize(1)));

        saveSettings(cookie, """
                {"lowStock": false, "outOfStock": false, "newDevice": true, "noSales": true, "noSalesDays": 3,
                 "expenseSpike": true, "expenseSpikePercent": 20}
                """);
        mockMvc.perform(get("/api/notifications").cookie(cookie)).andExpect(jsonPath("$", empty()));
    }

    @Test
    void noRecentSalesUsesTheDayCountTheUserChose() throws Exception {
        Cookie cookie = registerAndLogin();
        int itemId = item(cookie, "Candle", 50);
        sale(cookie, itemId, Instant.now().minus(10, ChronoUnit.DAYS));

        mockMvc.perform(get("/api/notifications").cookie(cookie))
                .andExpect(jsonPath("$[?(@.type == 'no-sales')]", hasSize(1)))
                .andExpect(jsonPath("$[?(@.type == 'no-sales')].link[0]").value("/sales"));

        saveSettings(cookie, ALL_ON.formatted(30, 20));
        mockMvc.perform(get("/api/notifications").cookie(cookie))
                .andExpect(jsonPath("$[?(@.type == 'no-sales')]", empty()));

        saveSettings(cookie, ALL_ON.formatted(3, 20));
        sale(cookie, itemId, Instant.now().minus(1, ChronoUnit.HOURS));
        mockMvc.perform(get("/api/notifications").cookie(cookie))
                .andExpect(jsonPath("$[?(@.type == 'no-sales')]", empty()));
    }

    @Test
    void anExpenseSpikeNeedsThisMonthToPassLastMonthByTheChosenPercent() throws Exception {
        Cookie cookie = registerAndLogin();
        YearMonth thisMonth = YearMonth.now(ZoneOffset.UTC);
        expense(cookie, thisMonth.minusMonths(1).atDay(15).atTime(12, 0).toInstant(ZoneOffset.UTC), 10000);
        expense(cookie, thisMonth.atDay(1).atTime(12, 0).toInstant(ZoneOffset.UTC), 13000);

        // 30% above last month: past the default 20%.
        mockMvc.perform(get("/api/notifications").cookie(cookie))
                .andExpect(jsonPath("$[?(@.type == 'expense-spike')]", hasSize(1)))
                .andExpect(jsonPath("$[?(@.type == 'expense-spike')].message[0]", containsString("30%")));

        saveSettings(cookie, ALL_ON.formatted(3, 50));
        mockMvc.perform(get("/api/notifications").cookie(cookie))
                .andExpect(jsonPath("$[?(@.type == 'expense-spike')]", empty()));
    }

    @Test
    void aNewDeviceIsReportedToTheOtherDevicesButNotToItself() throws Exception {
        String email = uniqueEmail();
        Cookie first = sessionCookie(mockMvc.perform(post("/api/auth/register")
                        .header("User-Agent", "First Browser")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Test Business\", \"email\": \"%s\", \"password\": \"correct-horse\"}"
                                .formatted(email)))
                .andExpect(status().isCreated())
                .andReturn());
        mockMvc.perform(post("/api/auth/login")
                        .header("User-Agent", "Second Browser")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\": \"%s\", \"password\": \"correct-horse\"}".formatted(email)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/notifications").cookie(first).header("User-Agent", "First Browser"))
                .andExpect(jsonPath("$[?(@.type == 'new-device')]", hasSize(1)))
                .andExpect(jsonPath("$[?(@.type == 'new-device')].userAgent[0]").value("Second Browser"));
        // The new device itself isn't told about itself.
        mockMvc.perform(get("/api/notifications").cookie(first).header("User-Agent", "Second Browser"))
                .andExpect(jsonPath("$[?(@.type == 'new-device')]", empty()));

        saveSettings(first, """
                {"lowStock": true, "outOfStock": true, "newDevice": false, "noSales": true, "noSalesDays": 3,
                 "expenseSpike": true, "expenseSpikePercent": 20}
                """);
        mockMvc.perform(get("/api/notifications").cookie(first).header("User-Agent", "First Browser"))
                .andExpect(jsonPath("$[?(@.type == 'new-device')]", empty()));
    }
}
