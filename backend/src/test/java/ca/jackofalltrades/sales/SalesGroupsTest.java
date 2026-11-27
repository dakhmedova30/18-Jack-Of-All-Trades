package ca.jackofalltrades.sales;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ca.jackofalltrades.PostgresTestBase;
import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.ResultActions;

class SalesGroupsTest extends PostgresTestBase {
    @Autowired JdbcClient jdbc;

    private ResultActions postJson(Cookie cookie, String path, String json) throws Exception {
        return mockMvc.perform(post(path).cookie(cookie).contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private ResultActions patchJson(Cookie cookie, String path, String json) throws Exception {
        return mockMvc.perform(patch(path).cookie(cookie).contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private int createdId(ResultActions result) throws Exception {
        return JsonPath.read(result.andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(), "$.id");
    }

    private int channel(int businessId, String name) {
        return jdbc.sql("SELECT id FROM channels WHERE business_id = :b AND name = :name")
                .param("b", businessId).param("name", name).query(Integer.class).single();
    }

    private int item(int businessId) {
        return jdbc.sql("""
                INSERT INTO items (business_id, name, quantity, unit_price_cents)
                VALUES (:b, 'Print', 10, 1000) RETURNING id
                """).param("b", businessId).query(Integer.class).single();
    }

    private int stock(int itemId) {
        return jdbc.sql("SELECT quantity FROM items WHERE id = :id").param("id", itemId).query(Integer.class).single();
    }

    private String sale(int channelId, int itemId, String extra) {
        return """
                {"soldAt":"2026-10-15T12:00:00Z","channelId":%d,"currency":"CAD",
                 "items":[{"itemId":%d,"quantity":2}],"tipCents":500%s}
                """.formatted(channelId, itemId, extra);
    }

    private static String expense() {
        return """
                {"spentOn":"2026-10-15","description":"Fee","category":"Costs",
                 "amountCents":300,"currency":"CAD","tags":[]}
                """;
    }

    @Test
    void onlineChannelSurvivesRenameAndDeletingMonthRestoresStock() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int online = channel(business, "Online");
        int item = item(business);
        createdId(postJson(cookie, "/api/sales", sale(online, item, "")));
        postJson(cookie, "/api/online-shop/expenses", expense()).andExpect(status().isCreated());
        mockMvc.perform(put("/api/channels/" + online).cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Etsy\"}")).andExpect(status().isOk())
                .andExpect(jsonPath("$.isOnline").value(true));
        mockMvc.perform(get("/api/online-shop/months").cookie(cookie))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].revenueCents").value(2500))
                .andExpect(jsonPath("$[0].expensesCents").value(300))
                .andExpect(jsonPath("$[0].profitCents").value(2200));
        postJson(cookie, "/api/online-shop/months/bulk-delete", "{\"months\":[\"2026-10\"]}")
                .andExpect(status().isOk());
        assertThat(stock(item)).isEqualTo(10);
        mockMvc.perform(get("/api/online-shop/months").cookie(cookie))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void previouslyRenamedChannelCanBeDesignatedWithoutChangingItsSales() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int online = channel(business, "Online");
        int item = item(business);
        createdId(postJson(cookie, "/api/sales", sale(online, item, "")));
        mockMvc.perform(put("/api/channels/" + online).cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Etsy\"}")).andExpect(status().isOk());
        jdbc.sql("UPDATE channels SET is_online = false WHERE id = :id").param("id", online).update();
        mockMvc.perform(put("/api/channels/" + online + "/online").cookie(cookie))
                .andExpect(status().isOk()).andExpect(jsonPath("$.isOnline").value(true));
        mockMvc.perform(get("/api/online-shop/months").cookie(cookie))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].revenueCents").value(2500));
        Cookie other = registerAndLogin();
        mockMvc.perform(put("/api/channels/" + online + "/online").cookie(other))
                .andExpect(status().isNotFound());
    }

    @Test
    void marketRevenueIncludesTipsAndDeletingMarketRestoresStock() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int item = item(business);
        int market = createdId(postJson(cookie, "/api/markets", """
                {"name":"Market","startDate":"2026-10-15","endDate":"2026-10-15",
                 "tableFeeCents":300,"extraExpensesCents":100,"currency":"CAD","status":"PENDING","going":"YES"}
                """));
        createdId(postJson(cookie, "/api/sales", sale(channel(business, "In person"), item, ",\"marketId\":" + market)));
        mockMvc.perform(get("/api/markets/" + market).cookie(cookie))
                .andExpect(status().isOk()).andExpect(jsonPath("$.revenueCents").value(2500))
                .andExpect(jsonPath("$.tipsCents").value(500))
                .andExpect(jsonPath("$.profitCents").value(2100));
        mockMvc.perform(delete("/api/markets/" + market).cookie(cookie)).andExpect(status().isNoContent());
        assertThat(stock(item)).isEqualTo(10);
    }

    @Test
    void commissionAndMiscellaneousTotalsAndDeadlineValidation() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int item = item(business);
        String commission = "{\"name\":\"Portrait\",\"receivedOn\":\"2026-10-10\",\"deadline\":\"2026-10-20\"}";
        postJson(cookie, "/api/commissions", "{\"name\":\"Bad\",\"receivedOn\":\"2026-10-10\",\"deadline\":\"2026-10-09\"}")
                .andExpect(status().isBadRequest());
        int id = createdId(postJson(cookie, "/api/commissions", commission));
        patchJson(cookie, "/api/commissions/" + id, "{\"name\":\"Portrait\",\"deadline\":\"2026-10-09\"}")
                .andExpect(status().isBadRequest());
        createdId(postJson(cookie, "/api/sales", sale(channel(business, "Commission"), item, ",\"commissionId\":" + id)));
        postJson(cookie, "/api/commissions/" + id + "/expenses", expense()).andExpect(status().isCreated());
        mockMvc.perform(get("/api/commissions/" + id).cookie(cookie))
                .andExpect(status().isOk()).andExpect(jsonPath("$.revenueCents").value(2500))
                .andExpect(jsonPath("$.tipsCents").value(500)).andExpect(jsonPath("$.profitCents").value(2200));

        int misc = createdId(postJson(cookie, "/api/miscellaneous", "{\"name\":\"Other\"}"));
        createdId(postJson(cookie, "/api/sales", sale(channel(business, "Misc"), item, ",\"miscId\":" + misc)));
        postJson(cookie, "/api/miscellaneous/" + misc + "/expenses", expense()).andExpect(status().isCreated());
        mockMvc.perform(get("/api/miscellaneous/" + misc).cookie(cookie))
                .andExpect(status().isOk()).andExpect(jsonPath("$.revenueCents").value(2500))
                .andExpect(jsonPath("$.profitCents").value(2200));
    }

    @Test
    void inactiveFreeItemsAndDetachedOneTimeItemsRemainEditableButCannotBeAdded() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int item = item(business);
        int misc = createdId(postJson(cookie, "/api/miscellaneous", "{\"name\":\"Other\"}"));
        int channel = channel(business, "Misc");
        String lines = """
                {"soldAt":"2026-10-15T12:00:00Z","channelId":%d,"items":[
                 {"itemId":%d,"quantity":1,"isFree":true},
                 {"itemId":null,"itemName":"Custom","quantity":1,"unitPriceCents":400}]%s}
                """;
        int id = createdId(postJson(cookie, "/api/sales", lines.formatted(channel, item, ",\"miscId\":" + misc)));
        jdbc.sql("UPDATE items SET is_active = false WHERE id = :id").param("id", item).update();
        mockMvc.perform(delete("/api/miscellaneous/" + misc).cookie(cookie)).andExpect(status().isNoContent());
        patchJson(cookie, "/api/sales/" + id, lines.formatted(channel, item, ""))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalCents").value(400));
        patchJson(cookie, "/api/sales/" + id, lines.formatted(channel, item, "").replace("Custom", "Updated custom"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[1].itemName").value("Updated custom"));
        patchJson(cookie, "/api/sales/" + id, lines.formatted(channel, item, "").replace("\"quantity\":1,\"isFree\"", "\"quantity\":2,\"isFree\""))
                .andExpect(status().isBadRequest());
        postJson(cookie, "/api/sales", lines.formatted(channel, item, "")).andExpect(status().isBadRequest());
    }

    @Test
    void duplicateDiscountIdsAreRejected() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int item = item(business);
        postJson(cookie, "/api/sales", sale(channel(business, "Online"), item, ",\"discountIds\":[1,1]"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Each discount or charge can only be applied once"));
        assertThat(stock(item)).isEqualTo(10);
    }
}
