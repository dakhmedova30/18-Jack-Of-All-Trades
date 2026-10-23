package ca.jackofalltrades.items;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
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

/** Contract §3: creating, updating and deleting items. */
class ItemWriteTest extends PostgresTestBase {

    @Autowired
    private JdbcClient jdbcClient;

    private ResultActions create(Cookie cookie, String json) throws Exception {
        return mockMvc.perform(post("/api/items").cookie(cookie)
                .contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private ResultActions update(Cookie cookie, int id, String json) throws Exception {
        return mockMvc.perform(patch("/api/items/" + id).cookie(cookie)
                .contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private int createdId(Cookie cookie, String name, int quantity, int priceCents) throws Exception {
        String body = create(cookie, """
                        {"name": "%s", "quantity": %d, "unitPriceCents": %d}
                        """.formatted(name, quantity, priceCents))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    private long itemCount(int businessId) {
        return jdbcClient.sql("SELECT COUNT(*) FROM items WHERE business_id = :b").param("b", businessId)
                .query(Long.class).single();
    }

    // ---- POST /api/items ----

    @Test
    void requiresLogin() throws Exception {
        mockMvc.perform(post("/api/items").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(patch("/api/items/1").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(delete("/api/items/1"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/items/bulk-delete").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void createsAnItemTrimmingAndDedupingTags() throws Exception {
        Cookie cookie = registerAndLogin();

        String body = create(cookie, """
                        {"name": "  Flower Print ", "quantity": 10, "unitPriceCents": 1200,
                         "tags": [" print ", "print", "art"], "note": "A5"}
                        """)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.name").value("Flower Print"))
                .andExpect(jsonPath("$.quantity").value(10))
                .andExpect(jsonPath("$.unitPriceCents").value(1200))
                .andExpect(jsonPath("$.tags", contains("print", "art")))
                .andExpect(jsonPath("$.note").value("A5"))
                .andExpect(jsonPath("$.createdAt").isString())
                .andExpect(jsonPath("$.updatedAt").isString())
                .andExpect(jsonPath("$.businessId").doesNotExist())
                .andReturn().getResponse().getContentAsString();

        int id = JsonPath.read(body, "$.id");
        mockMvc.perform(get("/api/items/" + id).cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Flower Print"));
    }

    @Test
    void tagsAndNoteDefaultToEmpty() throws Exception {
        Cookie cookie = registerAndLogin();

        create(cookie, """
                {"name": "Keychain", "quantity": 0, "unitPriceCents": 0}
                """)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.tags").isEmpty())
                .andExpect(jsonPath("$.note").value(""));
    }

    @Test
    void missingRequiredFieldsFailValidation() throws Exception {
        Cookie cookie = registerAndLogin();

        create(cookie, "{}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Validation failed"))
                .andExpect(jsonPath("$.error.details[*].field",
                        containsInAnyOrder("name", "quantity", "unitPriceCents")));
    }

    @Test
    void invalidFieldsFailValidation() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);

        create(cookie, """
                {"name": "   ", "quantity": -1, "unitPriceCents": -5, "tags": ["ok", " "], "note": "%s"}
                """.formatted("x".repeat(1001)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[*].field",
                        containsInAnyOrder("name", "quantity", "unitPriceCents", "tags.1", "note")))
                .andExpect(jsonPath("$.error.details[?(@.field == 'name')].message").value("Name is required"))
                .andExpect(jsonPath("$.error.details[?(@.field == 'quantity')].message")
                        .value("Quantity cannot be negative"));
        create(cookie, """
                {"name": "%s", "quantity": 1, "unitPriceCents": 1}
                """.formatted("n".repeat(121)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].field").value("name"));
        create(cookie, """
                {"name": "Many tags", "quantity": 1, "unitPriceCents": 1,
                 "tags": ["1","2","3","4","5","6","7","8","9","10","11"]}
                """)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].field").value("tags"));

        assertThat(itemCount(business)).isZero();
    }

    // ---- PATCH /api/items/{id} ----

    @Test
    void updateChangesOnlyTheFieldsSent() throws Exception {
        Cookie cookie = registerAndLogin();
        String body = create(cookie, """
                        {"name": "Flower Print", "quantity": 10, "unitPriceCents": 1200, "tags": ["print"], "note": "A5"}
                        """)
                .andReturn().getResponse().getContentAsString();
        int id = JsonPath.read(body, "$.id");

        update(cookie, id, """
                {"unitPriceCents": 1500, "tags": ["print", "sale"]}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.name").value("Flower Print"))
                .andExpect(jsonPath("$.quantity").value(10))
                .andExpect(jsonPath("$.unitPriceCents").value(1500))
                .andExpect(jsonPath("$.tags", contains("print", "sale")))
                .andExpect(jsonPath("$.note").value("A5"));

        update(cookie, id, """
                {"name": " Rose Print ", "quantity": 0, "tags": [], "note": ""}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Rose Print"))
                .andExpect(jsonPath("$.quantity").value(0))
                .andExpect(jsonPath("$.unitPriceCents").value(1500))
                .andExpect(jsonPath("$.tags").isEmpty())
                .andExpect(jsonPath("$.note").value(""));
    }

    @Test
    void emptyUpdateIsRejected() throws Exception {
        Cookie cookie = registerAndLogin();
        int id = createdId(cookie, "Flower Print", 10, 1200);

        update(cookie, id, "{}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Provide at least one field to update"));
    }

    @Test
    void invalidUpdateFailsValidation() throws Exception {
        Cookie cookie = registerAndLogin();
        int id = createdId(cookie, "Flower Print", 10, 1200);

        update(cookie, id, """
                {"name": "", "quantity": -1}
                """)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[*].field", containsInAnyOrder("name", "quantity")));
        mockMvc.perform(get("/api/items/" + id).cookie(cookie))
                .andExpect(jsonPath("$.name").value("Flower Print"))
                .andExpect(jsonPath("$.quantity").value(10));
    }

    @Test
    void updatingAnotherBusinesssItemIsNotFound() throws Exception {
        Cookie owner = registerAndLogin();
        int id = createdId(owner, "Secret Item", 1, 100);
        Cookie someoneElse = registerAndLogin();

        update(someoneElse, id, """
                {"quantity": 99}
                """)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.message").value("Item " + id + " not found"));
        mockMvc.perform(get("/api/items/" + id).cookie(owner))
                .andExpect(jsonPath("$.quantity").value(1));
    }

    @Test
    void invalidIdIsRejected() throws Exception {
        Cookie cookie = registerAndLogin();

        update(cookie, 0, "{\"quantity\": 1}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Invalid item id: \"0\""));
        mockMvc.perform(delete("/api/items/abc").cookie(cookie))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Invalid item id: \"abc\""));
    }

    // ---- DELETE /api/items/{id} ----

    @Test
    void deletesAnItem() throws Exception {
        Cookie cookie = registerAndLogin();
        int id = createdId(cookie, "Flower Print", 10, 1200);

        mockMvc.perform(delete("/api/items/" + id).cookie(cookie))
                .andExpect(status().isNoContent())
                .andExpect(content().string(""));
        mockMvc.perform(get("/api/items/" + id).cookie(cookie))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/items/" + id).cookie(cookie))
                .andExpect(status().isNotFound());
    }

    @Test
    void deletingAnotherBusinesssItemIsNotFound() throws Exception {
        Cookie owner = registerAndLogin();
        int id = createdId(owner, "Secret Item", 1, 100);
        Cookie someoneElse = registerAndLogin();

        mockMvc.perform(delete("/api/items/" + id).cookie(someoneElse))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/items/" + id).cookie(owner))
                .andExpect(status().isOk());
    }

    @Test
    void pastSalesKeepADeletedItemsName() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int id = createdId(cookie, "Flower Print", 10, 1200);
        int channel = jdbcClient.sql("SELECT id FROM channels WHERE business_id = :b AND name = 'Online'")
                .param("b", business).query(Integer.class).single();
        String sale = mockMvc.perform(post("/api/sales").cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"soldAt": "2026-10-18T15:30:00Z", "channelId": %d,
                                 "items": [{"itemId": %d, "quantity": 2}]}
                                """.formatted(channel, id)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        int saleId = JsonPath.read(sale, "$.id");

        mockMvc.perform(delete("/api/items/" + id).cookie(cookie))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/sales/" + saleId).cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].itemId").isEmpty())
                .andExpect(jsonPath("$.items[0].itemName").value("Flower Print"))
                .andExpect(jsonPath("$.items[0].quantity").value(2))
                .andExpect(jsonPath("$.totalCents").value(2400));
    }

    // ---- POST /api/items/bulk-delete ----

    @Test
    void bulkDeleteSkipsIdsThatArentTheBusinesss() throws Exception {
        Cookie owner = registerAndLogin();
        int first = createdId(owner, "First", 1, 100);
        int second = createdId(owner, "Second", 1, 100);
        int kept = createdId(owner, "Kept", 1, 100);
        Cookie someoneElse = registerAndLogin();
        int others = createdId(someoneElse, "Not Yours", 1, 100);

        mockMvc.perform(post("/api/items/bulk-delete").cookie(owner).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\": [%d, %d, %d, %d, 999999999]}".formatted(first, second, first, others)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deleted").value(2));

        mockMvc.perform(get("/api/items").cookie(owner))
                .andExpect(jsonPath("$.data[*].id", contains(kept)));
        mockMvc.perform(get("/api/items/" + others).cookie(someoneElse))
                .andExpect(status().isOk());
    }

    @Test
    void bulkDeleteValidatesIds() throws Exception {
        Cookie cookie = registerAndLogin();

        mockMvc.perform(post("/api/items/bulk-delete").cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\": []}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].message").value("Select at least one item"));
        mockMvc.perform(post("/api/items/bulk-delete").cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\": [1, -2]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].field").value("ids.1"));
    }
}
