package ca.jackofalltrades.sales;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ca.jackofalltrades.PostgresTestBase;
import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.ResultActions;

/** Contract §4: recording, replacing and deleting sales, and their effect on stock. */
class SaleWriteTest extends PostgresTestBase {

    private static final String SOLD_AT = "2026-10-18T15:30:00-04:00";

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

    private int stock(int itemId) {
        return jdbcClient.sql("SELECT quantity FROM items WHERE id = :id").param("id", itemId)
                .query(Integer.class).single();
    }

    private int channelId(int businessId, String name) {
        return jdbcClient.sql("SELECT id FROM channels WHERE business_id = :b AND name = :n")
                .param("b", businessId).param("n", name).query(Integer.class).single();
    }

    private long saleCount(int businessId) {
        return jdbcClient.sql("SELECT COUNT(*) FROM sales WHERE business_id = :b").param("b", businessId)
                .query(Long.class).single();
    }

    /** A SaleInput body with no description or tags; {@code lines} pairs item ids and quantities. */
    private static String input(int channelId, int... lines) {
        List<String> items = new ArrayList<>();
        for (int i = 0; i < lines.length; i += 2) {
            items.add("{\"itemId\": " + lines[i] + ", \"quantity\": " + lines[i + 1] + "}");
        }
        return "{\"soldAt\": \"" + SOLD_AT + "\", \"channelId\": " + channelId
                + ", \"items\": [" + String.join(", ", items) + "]}";
    }

    private ResultActions record(Cookie cookie, String json) throws Exception {
        return mockMvc.perform(post("/api/sales").cookie(cookie)
                .contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private ResultActions replace(Cookie cookie, int saleId, String json) throws Exception {
        return mockMvc.perform(patch("/api/sales/" + saleId).cookie(cookie)
                .contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private int recordedId(ResultActions result) throws Exception {
        return JsonPath.read(result.andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(),
                "$.id");
    }

    // ---- POST /api/sales ----

    @Test
    void requiresLogin() throws Exception {
        mockMvc.perform(post("/api/sales").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void recordsASaleCopyingPricesAndTakingStock() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int online = channelId(business, "Online");
        int print = insertItem(business, "Flower Print", 5, 1200);
        int keychain = insertItem(business, "Flower Keychain", 3, 1100);

        record(cookie, """
                {"soldAt": "2026-10-18T15:30:00-04:00", "channelId": %d, "tags": [" market ", "market"],
                 "items": [{"itemId": %d, "quantity": 2}, {"itemId": %d, "quantity": 1}]}
                """.formatted(online, print, keychain))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.soldAt").value("2026-10-18T19:30:00Z"))
                .andExpect(jsonPath("$.channel.id").value(online))
                .andExpect(jsonPath("$.channel.name").value("Online"))
                .andExpect(jsonPath("$.description").value("Flower Print x 2, Flower Keychain x 1"))
                .andExpect(jsonPath("$.tags", contains("market")))
                .andExpect(jsonPath("$.totalCents").value(3500))
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].id").isNumber())
                .andExpect(jsonPath("$.items[0].itemId").value(print))
                .andExpect(jsonPath("$.items[0].itemName").value("Flower Print"))
                .andExpect(jsonPath("$.items[0].quantity").value(2))
                .andExpect(jsonPath("$.items[0].unitPriceCents").value(1200))
                .andExpect(jsonPath("$.items[0].totalCents").value(2400))
                .andExpect(jsonPath("$.items[1].totalCents").value(1100))
                .andExpect(jsonPath("$.createdAt").isString())
                .andExpect(jsonPath("$.updatedAt").isString());

        assertThat(stock(print)).isEqualTo(3);
        assertThat(stock(keychain)).isEqualTo(2);
    }

    @Test
    void laterPriceChangesDontChangeTheSale() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int print = insertItem(business, "Flower Print", 5, 1200);
        int saleId = recordedId(record(cookie, input(channelId(business, "Online"), print, 1)));

        jdbcClient.sql("UPDATE items SET unit_price_cents = 9999, name = 'Renamed' WHERE id = :id")
                .param("id", print).update();

        mockMvc.perform(get("/api/sales/" + saleId).cookie(cookie))
                .andExpect(jsonPath("$.items[0].itemName").value("Flower Print"))
                .andExpect(jsonPath("$.items[0].unitPriceCents").value(1200))
                .andExpect(jsonPath("$.totalCents").value(1200));
    }

    @Test
    void notEnoughStockSavesNothing() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int keychain = insertItem(business, "Keychain", 5, 100);
        int print = insertItem(business, "Flower Print", 1, 1200);

        record(cookie, input(channelId(business, "Online"), keychain, 2, print, 2))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Not enough stock for \"Flower Print\" (have 1, need 2)"));

        assertThat(stock(keychain)).isEqualTo(5);
        assertThat(stock(print)).isEqualTo(1);
        assertThat(saleCount(business)).isZero();
    }

    @Test
    void sameItemOnTwoLinesSharesItsStock() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int online = channelId(business, "Online");
        int print = insertItem(business, "Flower Print", 3, 100);

        record(cookie, input(online, print, 2, print, 2))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Not enough stock for \"Flower Print\" (have 1, need 2)"));
        record(cookie, input(online, print, 2, print, 1)).andExpect(status().isCreated());

        assertThat(stock(print)).isZero();
    }

    @Test
    void anotherBusinesssItemOrChannelDoesNotExist() throws Exception {
        Cookie mine = registerAndLogin();
        Cookie theirs = registerAndLogin();
        int myBusiness = businessId(mine);
        int theirBusiness = businessId(theirs);
        int myItem = insertItem(myBusiness, "Mine", 5, 100);
        int theirItem = insertItem(theirBusiness, "Theirs", 5, 100);
        int theirChannel = channelId(theirBusiness, "Online");

        record(mine, input(channelId(myBusiness, "Online"), theirItem, 1))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Item " + theirItem + " does not exist"));
        // The channel is checked before the items.
        record(mine, input(theirChannel, theirItem, 1))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Channel " + theirChannel + " does not exist"));
        record(mine, input(theirChannel, myItem, 1)).andExpect(status().isBadRequest());

        assertThat(stock(theirItem)).isEqualTo(5);
        assertThat(stock(myItem)).isEqualTo(5);
    }

    @Test
    void validationErrorsUseDottedPaths() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int online = channelId(business, "Online");
        int print = insertItem(business, "Flower Print", 5, 100);

        record(cookie, input(online, print, 1, print, 0))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Validation failed"))
                .andExpect(jsonPath("$.error.details[0].field").value("items.1.quantity"));
        record(cookie, input(online).replace(SOLD_AT, "2026-10-18T15:30:00"))
                .andExpect(jsonPath("$.error.details[*].field", containsInAnyOrder("soldAt", "items")));
        record(cookie, input(online))
                .andExpect(jsonPath("$.error.details[0].field").value("items"))
                .andExpect(jsonPath("$.error.details[0].message").value("A sale needs at least one item"));
        record(cookie, """
                {"soldAt": "%s", "items": [{"itemId": %d, "quantity": 1}], "tags": ["%s"]}
                """.formatted(SOLD_AT, print, "x".repeat(31)))
                .andExpect(jsonPath("$.error.details[*].field", containsInAnyOrder("channelId", "tags.0")));
        record(cookie, "{\"soldAt\": ")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Request body is not valid JSON"));

        assertThat(stock(print)).isEqualTo(5);
    }

    @Test
    void descriptionIsTrimmedOrWrittenFromTheLines() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int online = channelId(business, "Online");
        int longName = insertItem(business, "L".repeat(150), 10, 100);
        int other = insertItem(business, "Other " + "O".repeat(100), 10, 100);

        record(cookie, """
                {"soldAt": "%s", "channelId": %d, "description": "  Gift for Sam  ",
                 "items": [{"itemId": %d, "quantity": 1}]}
                """.formatted(SOLD_AT, online, other))
                .andExpect(jsonPath("$.description").value("Gift for Sam"))
                .andExpect(jsonPath("$.tags").isEmpty());

        String body = record(cookie, input(online, longName, 1, other, 1))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String description = JsonPath.read(body, "$.description");
        assertThat(description).hasSize(200).endsWith("…").startsWith("L".repeat(150) + " x 1, Other ");
    }

    @Test
    void totalTooLargeIsOutOfRange() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int pricey = insertItem(business, "Pricey", 5, 2_000_000_000);

        record(cookie, input(channelId(business, "Online"), pricey, 2))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Number is out of range"));
        assertThat(stock(pricey)).isEqualTo(5);
    }

    @Test
    void twoSalesOfTheLastUnitAtOnceOnlyOneSucceeds() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int online = channelId(business, "Online");
        int last = insertItem(business, "Last One", 1, 100);

        CountDownLatch start = new CountDownLatch(1);
        Callable<Integer> sell = () -> {
            start.await();
            return record(cookie, input(online, last, 1)).andReturn().getResponse().getStatus();
        };
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<Integer> first = pool.submit(sell);
            Future<Integer> second = pool.submit(sell);
            start.countDown();
            assertThat(List.of(first.get(), second.get())).containsExactlyInAnyOrder(201, 400);
        } finally {
            pool.shutdown();
        }
        assertThat(stock(last)).isZero();
        assertThat(saleCount(business)).isEqualTo(1);
    }

    // ---- PATCH /api/sales/{id} ----

    @Test
    void replaceRestoresOldLinesThenAppliesNewOnes() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int online = channelId(business, "Online");
        int print = insertItem(business, "Print", 3, 100);
        int keychain = insertItem(business, "Keychain", 5, 200);
        int saleId = recordedId(record(cookie, input(online, print, 3)));
        assertThat(stock(print)).isZero();

        // Editing up to exactly the stock the sale already holds works.
        replace(cookie, saleId, input(online, print, 3)).andExpect(status().isOk());
        assertThat(stock(print)).isZero();

        replace(cookie, saleId, input(channelId(business, "Misc"), print, 1, keychain, 2))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(saleId))
                .andExpect(jsonPath("$.channel.name").value("Misc"))
                .andExpect(jsonPath("$.description").value("Print x 1, Keychain x 2"))
                .andExpect(jsonPath("$.items[*].itemName", contains("Print", "Keychain")))
                .andExpect(jsonPath("$.totalCents").value(500));
        assertThat(stock(print)).isEqualTo(2);
        assertThat(stock(keychain)).isEqualTo(3);
    }

    @Test
    void failedReplaceChangesNothing() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int online = channelId(business, "Online");
        int print = insertItem(business, "Print", 3, 100);
        int saleId = recordedId(record(cookie, input(online, print, 2)));

        replace(cookie, saleId, input(online, print, 4))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Not enough stock for \"Print\" (have 3, need 4)"));

        assertThat(stock(print)).isEqualTo(1);
        mockMvc.perform(get("/api/sales/" + saleId).cookie(cookie))
                .andExpect(jsonPath("$.items[0].quantity").value(2));
    }

    @Test
    void replaceChangesUpdatedAtEvenWhenOnlyLinesChange() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int online = channelId(business, "Online");
        int print = insertItem(business, "Print", 5, 100);
        String created = record(cookie, input(online, print, 1))
                .andReturn().getResponse().getContentAsString();
        int saleId = JsonPath.read(created, "$.id");
        Thread.sleep(5);

        replace(cookie, saleId, input(online, print, 2))
                .andExpect(jsonPath("$.createdAt").value((String) JsonPath.read(created, "$.createdAt")))
                .andExpect(jsonPath("$.updatedAt").value(not((String) JsonPath.read(created, "$.updatedAt"))));
    }

    @Test
    void replaceOfMissingOrAnotherBusinesssSaleIs404() throws Exception {
        Cookie mine = registerAndLogin();
        Cookie theirs = registerAndLogin();
        int theirBusiness = businessId(theirs);
        int theirItem = insertItem(theirBusiness, "Theirs", 5, 100);
        int theirSale = recordedId(record(theirs, input(channelId(theirBusiness, "Online"), theirItem, 1)));

        replace(mine, theirSale, input(channelId(businessId(mine), "Online"), theirItem, 1))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.message").value("Sale " + theirSale + " not found"));
        assertThat(stock(theirItem)).isEqualTo(4);
    }

    // ---- DELETE /api/sales/{id} and POST /api/sales/bulk-delete ----

    @Test
    void deleteRestoresStock() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int print = insertItem(business, "Print", 3, 100);
        int saleId = recordedId(record(cookie, input(channelId(business, "Online"), print, 2)));

        mockMvc.perform(delete("/api/sales/" + saleId).cookie(cookie))
                .andExpect(status().isNoContent());

        assertThat(stock(print)).isEqualTo(3);
        mockMvc.perform(get("/api/sales/" + saleId).cookie(cookie)).andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/sales/" + saleId).cookie(cookie)).andExpect(status().isNotFound());
    }

    @Test
    void deletingASaleWhoseItemWasDeletedWorks() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int print = insertItem(business, "Print", 3, 100);
        int saleId = recordedId(record(cookie, input(channelId(business, "Online"), print, 2)));
        jdbcClient.sql("DELETE FROM items WHERE id = :id").param("id", print).update();

        mockMvc.perform(get("/api/sales/" + saleId).cookie(cookie))
                .andExpect(jsonPath("$.items[0].itemId").isEmpty())
                .andExpect(jsonPath("$.items[0].itemName").value("Print"));
        mockMvc.perform(delete("/api/sales/" + saleId).cookie(cookie))
                .andExpect(status().isNoContent());
    }

    @Test
    void deleteOfAnotherBusinesssSaleIs404() throws Exception {
        Cookie mine = registerAndLogin();
        Cookie theirs = registerAndLogin();
        int theirBusiness = businessId(theirs);
        int theirItem = insertItem(theirBusiness, "Theirs", 5, 100);
        int theirSale = recordedId(record(theirs, input(channelId(theirBusiness, "Online"), theirItem, 1)));

        mockMvc.perform(delete("/api/sales/" + theirSale).cookie(mine))
                .andExpect(status().isNotFound());
        assertThat(stock(theirItem)).isEqualTo(4);
    }

    @Test
    void bulkDeleteCountsOnlyYourSalesOnce() throws Exception {
        Cookie mine = registerAndLogin();
        Cookie theirs = registerAndLogin();
        int myBusiness = businessId(mine);
        int theirBusiness = businessId(theirs);
        int online = channelId(myBusiness, "Online");
        int print = insertItem(myBusiness, "Print", 10, 100);
        int theirItem = insertItem(theirBusiness, "Theirs", 5, 100);
        int first = recordedId(record(mine, input(online, print, 2)));
        int second = recordedId(record(mine, input(online, print, 3)));
        int kept = recordedId(record(mine, input(online, print, 1)));
        int theirSale = recordedId(record(theirs, input(channelId(theirBusiness, "Online"), theirItem, 1)));

        mockMvc.perform(post("/api/sales/bulk-delete").cookie(mine).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\": [%d, %d, %d, %d, 999999999]}".formatted(second, first, first, theirSale)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deleted").value(2));

        assertThat(stock(print)).isEqualTo(9);
        assertThat(stock(theirItem)).isEqualTo(4);
        mockMvc.perform(get("/api/sales").cookie(mine))
                .andExpect(jsonPath("$.data[*].id", contains(kept)));
    }

    @Test
    void bulkDeleteNeedsAtLeastOneId() throws Exception {
        Cookie cookie = registerAndLogin();

        mockMvc.perform(post("/api/sales/bulk-delete").cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\": []}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].field").value("ids"))
                .andExpect(jsonPath("$.error.details[0].message").value("Select at least one sale"));
    }
}
