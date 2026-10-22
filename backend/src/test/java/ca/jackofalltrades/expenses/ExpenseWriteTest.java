package ca.jackofalltrades.expenses;

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

/** Contract §5: recording, replacing and deleting expenses, and the restocks they make. */
class ExpenseWriteTest extends PostgresTestBase {

    private static final String INCURRED_AT = "2026-10-10T08:00:00-04:00";

    @Autowired
    private JdbcClient jdbcClient;

    private int insertItem(int businessId, String name, int quantity) {
        return jdbcClient.sql("""
                        INSERT INTO items (business_id, name, quantity, unit_price_cents)
                        VALUES (:b, :name, :quantity, 1200) RETURNING id
                        """)
                .param("b", businessId).param("name", name).param("quantity", quantity)
                .query(Integer.class).single();
    }

    private int stock(int itemId) {
        return jdbcClient.sql("SELECT quantity FROM items WHERE id = :id").param("id", itemId)
                .query(Integer.class).single();
    }

    private long expenseCount(int businessId) {
        return jdbcClient.sql("SELECT COUNT(*) FROM expenses WHERE business_id = :b").param("b", businessId)
                .query(Long.class).single();
    }

    /** A restock line JSON: {@code quantity} of the item at {@code unitCostCents} each. */
    private static String restock(int itemId, int quantity, int unitCostCents) {
        return "{\"itemId\": %d, \"quantity\": %d, \"unitCostCents\": %d}".formatted(itemId, quantity, unitCostCents);
    }

    /** A plain-cost line JSON with no item. */
    private static String cost(String description, int quantity, int unitCostCents) {
        return "{\"itemId\": null, \"description\": \"%s\", \"quantity\": %d, \"unitCostCents\": %d}"
                .formatted(description, quantity, unitCostCents);
    }

    /** An ExpenseInput body with no description or tags. */
    private static String input(String... lines) {
        return "{\"incurredAt\": \"" + INCURRED_AT + "\", \"items\": [" + String.join(", ", lines) + "]}";
    }

    private ResultActions record(Cookie cookie, String json) throws Exception {
        return mockMvc.perform(post("/api/expenses").cookie(cookie)
                .contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private ResultActions replace(Cookie cookie, int expenseId, String json) throws Exception {
        return mockMvc.perform(patch("/api/expenses/" + expenseId).cookie(cookie)
                .contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private int recordedId(ResultActions result) throws Exception {
        return JsonPath.read(result.andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(),
                "$.id");
    }

    /** Sells units directly, as a sale would, so an undo has less stock to take back. */
    private void sell(int itemId, int quantity) {
        jdbcClient.sql("UPDATE items SET quantity = quantity - :q WHERE id = :id")
                .param("q", quantity).param("id", itemId).update();
    }

    // ---- POST /api/expenses ----

    @Test
    void requiresLogin() throws Exception {
        mockMvc.perform(post("/api/expenses").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void recordsAnExpenseRestockingItemsAndKeepingPlainCosts() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int print = insertItem(business, "Flower Print", 10);

        record(cookie, """
                {"incurredAt": "2026-10-10T08:00:00-04:00", "tags": [" supplies ", "supplies"],
                 "items": [%s, %s]}
                """.formatted(restock(print, 200, 75), cost("  Shipping  ", 1, 2500)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.incurredAt").value("2026-10-10T12:00:00Z"))
                .andExpect(jsonPath("$.description").value("Flower Print x 200, Shipping x 1"))
                .andExpect(jsonPath("$.tags", contains("supplies")))
                .andExpect(jsonPath("$.totalCents").value(17500))
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].id").isNumber())
                .andExpect(jsonPath("$.items[0].itemId").value(print))
                .andExpect(jsonPath("$.items[0].itemName").value("Flower Print"))
                .andExpect(jsonPath("$.items[0].quantity").value(200))
                .andExpect(jsonPath("$.items[0].unitCostCents").value(75))
                .andExpect(jsonPath("$.items[0].totalCents").value(15000))
                .andExpect(jsonPath("$.items[1].itemId").isEmpty())
                .andExpect(jsonPath("$.items[1].itemName").value("Shipping"))
                .andExpect(jsonPath("$.items[1].totalCents").value(2500))
                .andExpect(jsonPath("$.createdAt").isString())
                .andExpect(jsonPath("$.updatedAt").isString());

        assertThat(stock(print)).isEqualTo(210);
    }

    @Test
    void omittedItemIdIsAPlainCostAndAnItemWinsOverADescription() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int print = insertItem(business, "Flower Print", 0);

        record(cookie, input(
                "{\"description\": \"Rent\", \"quantity\": 1, \"unitCostCents\": 50000}",
                "{\"itemId\": %d, \"description\": \"ignored\", \"quantity\": 5, \"unitCostCents\": 0}".formatted(print)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.items[0].itemId").isEmpty())
                .andExpect(jsonPath("$.items[0].itemName").value("Rent"))
                .andExpect(jsonPath("$.items[1].itemName").value("Flower Print"))
                .andExpect(jsonPath("$.totalCents").value(50000));
        assertThat(stock(print)).isEqualTo(5);
    }

    @Test
    void laterRenamesDontChangeTheExpense() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int print = insertItem(business, "Flower Print", 0);
        int expenseId = recordedId(record(cookie, input(restock(print, 1, 75))));

        jdbcClient.sql("UPDATE items SET name = 'Renamed' WHERE id = :id").param("id", print).update();

        mockMvc.perform(get("/api/expenses/" + expenseId).cookie(cookie))
                .andExpect(jsonPath("$.items[0].itemName").value("Flower Print"));
    }

    @Test
    void anotherBusinesssItemDoesNotExistAndNothingIsSaved() throws Exception {
        Cookie mine = registerAndLogin();
        Cookie theirs = registerAndLogin();
        int myBusiness = businessId(mine);
        int myItem = insertItem(myBusiness, "Mine", 5);
        int theirItem = insertItem(businessId(theirs), "Theirs", 5);

        record(mine, input(restock(myItem, 3, 10), restock(theirItem, 1, 10)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Item " + theirItem + " does not exist"));

        assertThat(stock(myItem)).isEqualTo(5);
        assertThat(stock(theirItem)).isEqualTo(5);
        assertThat(expenseCount(myBusiness)).isZero();
    }

    @Test
    void validationErrorsUseDottedPaths() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int print = insertItem(business, "Flower Print", 5);

        record(cookie, input(restock(print, 1, 10), restock(print, 0, 10)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Validation failed"))
                .andExpect(jsonPath("$.error.details[0].field").value("items.1.quantity"));
        record(cookie, input(restock(print, 1, -1)))
                .andExpect(jsonPath("$.error.details[0].field").value("items.0.unitCostCents"))
                .andExpect(jsonPath("$.error.details[0].message").value("Cost cannot be negative"));
        record(cookie, input(cost("   ", 1, 10)))
                .andExpect(jsonPath("$.error.details[0].field").value("items.0.description"))
                .andExpect(jsonPath("$.error.details[0].message").value("Pick an item or enter a description"));
        record(cookie, input(cost("x".repeat(121), 1, 10)))
                .andExpect(jsonPath("$.error.details[0].field").value("items.0.description"));
        record(cookie, input().replace(INCURRED_AT, "2026-10-10T08:00:00"))
                .andExpect(jsonPath("$.error.details[*].field", containsInAnyOrder("incurredAt", "items")));
        record(cookie, input())
                .andExpect(jsonPath("$.error.details[0].field").value("items"))
                .andExpect(jsonPath("$.error.details[0].message").value("An expense needs at least one line"));
        record(cookie, """
                {"incurredAt": "%s", "description": "%s", "tags": ["%s"], "items": [%s]}
                """.formatted(INCURRED_AT, "d".repeat(201), "x".repeat(31), cost("Rent", 1, 10)))
                .andExpect(jsonPath("$.error.details[*].field", containsInAnyOrder("description", "tags.0")));
        record(cookie, "{\"incurredAt\": ")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Request body is not valid JSON"));

        assertThat(stock(print)).isEqualTo(5);
        assertThat(expenseCount(business)).isZero();
    }

    @Test
    void descriptionIsTrimmedOrWrittenFromTheLines() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int longName = insertItem(business, "L".repeat(150), 0);

        record(cookie, """
                {"incurredAt": "%s", "description": "  Market booth  ", "items": [%s]}
                """.formatted(INCURRED_AT, cost("Fee", 1, 100)))
                .andExpect(jsonPath("$.description").value("Market booth"))
                .andExpect(jsonPath("$.tags").isEmpty());

        String body = record(cookie, input(restock(longName, 1, 0), cost("O".repeat(100), 1, 0)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String description = JsonPath.read(body, "$.description");
        assertThat(description).hasSize(200).endsWith("…").startsWith("L".repeat(150) + " x 1, OOO");
    }

    @Test
    void totalTooLargeIsOutOfRange() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int print = insertItem(business, "Print", 5);

        record(cookie, input(restock(print, 2, 2_000_000_000)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Number is out of range"));
        assertThat(stock(print)).isEqualTo(5);
    }

    // ---- PATCH /api/expenses/{id} ----

    @Test
    void replaceUndoesOldRestocksThenAppliesNewOnes() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int print = insertItem(business, "Print", 0);
        int keychain = insertItem(business, "Keychain", 1);
        int expenseId = recordedId(record(cookie, input(restock(print, 10, 50))));
        assertThat(stock(print)).isEqualTo(10);

        replace(cookie, expenseId, input(restock(print, 4, 50), restock(keychain, 2, 30), cost("Shipping", 1, 500)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(expenseId))
                .andExpect(jsonPath("$.description").value("Print x 4, Keychain x 2, Shipping x 1"))
                .andExpect(jsonPath("$.items[*].itemName", contains("Print", "Keychain", "Shipping")))
                .andExpect(jsonPath("$.totalCents").value(760));
        assertThat(stock(print)).isEqualTo(4);
        assertThat(stock(keychain)).isEqualTo(3);
    }

    @Test
    void replaceIsRejectedWhenTheRestockWasAlreadySold() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int print = insertItem(business, "Print", 0);
        int expenseId = recordedId(record(cookie, input(restock(print, 10, 50))));
        sell(print, 7);

        replace(cookie, expenseId, input(restock(print, 20, 50)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Can't undo the restock of \"Print\": only 3 in stock, "
                        + "need to remove 10 (some may have already been sold)"));

        assertThat(stock(print)).isEqualTo(3);
        mockMvc.perform(get("/api/expenses/" + expenseId).cookie(cookie))
                .andExpect(jsonPath("$.items[0].quantity").value(10));
    }

    @Test
    void replaceChangesUpdatedAtEvenWhenOnlyLinesChange() throws Exception {
        Cookie cookie = registerAndLogin();
        String created = record(cookie, input(cost("Rent", 1, 100)))
                .andReturn().getResponse().getContentAsString();
        int expenseId = JsonPath.read(created, "$.id");
        Thread.sleep(5);

        replace(cookie, expenseId, input(cost("Rent", 2, 100)))
                .andExpect(jsonPath("$.createdAt").value((String) JsonPath.read(created, "$.createdAt")))
                .andExpect(jsonPath("$.updatedAt").value(not((String) JsonPath.read(created, "$.updatedAt"))));
    }

    @Test
    void replaceOfMissingOrAnotherBusinesssExpenseIs404() throws Exception {
        Cookie mine = registerAndLogin();
        Cookie theirs = registerAndLogin();
        int theirItem = insertItem(businessId(theirs), "Theirs", 0);
        int theirExpense = recordedId(record(theirs, input(restock(theirItem, 5, 10))));

        replace(mine, theirExpense, input(cost("Rent", 1, 100)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.message").value("Expense " + theirExpense + " not found"));
        replace(mine, 999_999_999, input(cost("Rent", 1, 100))).andExpect(status().isNotFound());
        assertThat(stock(theirItem)).isEqualTo(5);
    }

    // ---- DELETE /api/expenses/{id} and POST /api/expenses/bulk-delete ----

    @Test
    void deleteUndoesTheRestock() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int print = insertItem(business, "Print", 2);
        int expenseId = recordedId(record(cookie, input(restock(print, 10, 50), cost("Shipping", 1, 500))));
        assertThat(stock(print)).isEqualTo(12);

        mockMvc.perform(delete("/api/expenses/" + expenseId).cookie(cookie))
                .andExpect(status().isNoContent());

        assertThat(stock(print)).isEqualTo(2);
        mockMvc.perform(get("/api/expenses/" + expenseId).cookie(cookie)).andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/expenses/" + expenseId).cookie(cookie)).andExpect(status().isNotFound());
    }

    @Test
    void deleteIsRejectedWhenTheRestockWasAlreadySold() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int print = insertItem(business, "Print", 0);
        int expenseId = recordedId(record(cookie, input(restock(print, 10, 50))));
        sell(print, 1);

        mockMvc.perform(delete("/api/expenses/" + expenseId).cookie(cookie))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Can't undo the restock of \"Print\": only 9 in stock, "
                        + "need to remove 10 (some may have already been sold)"));

        assertThat(stock(print)).isEqualTo(9);
        mockMvc.perform(get("/api/expenses/" + expenseId).cookie(cookie)).andExpect(status().isOk());
    }

    @Test
    void deletingAnExpenseWhoseItemWasDeletedWorks() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int print = insertItem(business, "Print", 0);
        int expenseId = recordedId(record(cookie, input(restock(print, 10, 50))));
        jdbcClient.sql("DELETE FROM items WHERE id = :id").param("id", print).update();

        mockMvc.perform(get("/api/expenses/" + expenseId).cookie(cookie))
                .andExpect(jsonPath("$.items[0].itemId").isEmpty())
                .andExpect(jsonPath("$.items[0].itemName").value("Print"));
        mockMvc.perform(delete("/api/expenses/" + expenseId).cookie(cookie))
                .andExpect(status().isNoContent());
    }

    @Test
    void deleteOfAnotherBusinesssExpenseIs404() throws Exception {
        Cookie mine = registerAndLogin();
        Cookie theirs = registerAndLogin();
        int theirItem = insertItem(businessId(theirs), "Theirs", 0);
        int theirExpense = recordedId(record(theirs, input(restock(theirItem, 5, 10))));

        mockMvc.perform(delete("/api/expenses/" + theirExpense).cookie(mine))
                .andExpect(status().isNotFound());
        assertThat(stock(theirItem)).isEqualTo(5);
    }

    @Test
    void twoDeletesOfTheSameExpenseAtOnceUndoItOnce() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int print = insertItem(business, "Print", 20);
        int expenseId = recordedId(record(cookie, input(restock(print, 10, 50))));

        CountDownLatch start = new CountDownLatch(1);
        Callable<Integer> remove = () -> {
            start.await();
            return mockMvc.perform(delete("/api/expenses/" + expenseId).cookie(cookie))
                    .andReturn().getResponse().getStatus();
        };
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<Integer> first = pool.submit(remove);
            Future<Integer> second = pool.submit(remove);
            start.countDown();
            assertThat(List.of(first.get(), second.get())).containsExactlyInAnyOrder(204, 404);
        } finally {
            pool.shutdown();
        }
        assertThat(stock(print)).isEqualTo(20);
    }

    @Test
    void bulkDeleteCountsOnlyYourExpensesOnce() throws Exception {
        Cookie mine = registerAndLogin();
        Cookie theirs = registerAndLogin();
        int myBusiness = businessId(mine);
        int print = insertItem(myBusiness, "Print", 0);
        int theirItem = insertItem(businessId(theirs), "Theirs", 0);
        int first = recordedId(record(mine, input(restock(print, 2, 10))));
        int second = recordedId(record(mine, input(restock(print, 3, 10))));
        int kept = recordedId(record(mine, input(restock(print, 1, 10))));
        int theirExpense = recordedId(record(theirs, input(restock(theirItem, 5, 10))));

        mockMvc.perform(post("/api/expenses/bulk-delete").cookie(mine).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\": [%d, %d, %d, %d, 999999999]}".formatted(second, first, first, theirExpense)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deleted").value(2));

        assertThat(stock(print)).isEqualTo(1);
        assertThat(stock(theirItem)).isEqualTo(5);
        mockMvc.perform(get("/api/expenses").cookie(mine))
                .andExpect(jsonPath("$.data[*].id", contains(kept)));
    }

    @Test
    void bulkDeleteDeletesNothingIfOneRestockWasAlreadySold() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int print = insertItem(business, "Print", 0);
        int keychain = insertItem(business, "Keychain", 0);
        int fine = recordedId(record(cookie, input(restock(keychain, 5, 10))));
        int sold = recordedId(record(cookie, input(restock(print, 5, 10))));
        sell(print, 5);

        mockMvc.perform(post("/api/expenses/bulk-delete").cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\": [%d, %d]}".formatted(fine, sold)))
                .andExpect(status().isBadRequest());

        assertThat(stock(keychain)).isEqualTo(5);
        assertThat(expenseCount(business)).isEqualTo(2);
    }

    @Test
    void bulkDeleteNeedsAtLeastOneId() throws Exception {
        Cookie cookie = registerAndLogin();

        mockMvc.perform(post("/api/expenses/bulk-delete").cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\": []}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].field").value("ids"))
                .andExpect(jsonPath("$.error.details[0].message").value("Select at least one expense"));
    }
}
