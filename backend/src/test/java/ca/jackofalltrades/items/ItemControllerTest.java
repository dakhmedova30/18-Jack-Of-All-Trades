package ca.jackofalltrades.items;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ca.jackofalltrades.PostgresTestBase;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;

/** Contract §3: GET /api/items and GET /api/items/{id}, scoped to the logged-in business. */
class ItemControllerTest extends PostgresTestBase {

    @Autowired
    private JdbcClient jdbcClient;

    /** Inserts an item directly (create endpoints come later) and returns its id. */
    private int insertItem(int businessId, String name, int quantity, int priceCents, String... tags) {
        return jdbcClient.sql("""
                        INSERT INTO items (business_id, name, quantity, unit_price_cents, tags)
                        VALUES (:businessId, :name, :quantity, :price, :tags) RETURNING id
                        """)
                .param("businessId", businessId)
                .param("name", name)
                .param("quantity", quantity)
                .param("price", priceCents)
                .param("tags", tags)
                .query(Integer.class)
                .single();
    }

    @Test
    void emptyListHasThePaginatedShape() throws Exception {
        Cookie cookie = registerAndLogin();

        mockMvc.perform(get("/api/items").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isEmpty())
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.pageSize").value(10))
                .andExpect(jsonPath("$.total").value(0))
                .andExpect(jsonPath("$.totalPages").value(1));
    }

    @Test
    void getReturnsTheItemJson() throws Exception {
        Cookie cookie = registerAndLogin();
        int id = insertItem(businessId(cookie), "Flower Print", 10, 1200, "print");

        mockMvc.perform(get("/api/items/" + id).cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.name").value("Flower Print"))
                .andExpect(jsonPath("$.quantity").value(10))
                .andExpect(jsonPath("$.unitPriceCents").value(1200))
                .andExpect(jsonPath("$.tags", contains("print")))
                .andExpect(jsonPath("$.note").value(""))
                .andExpect(jsonPath("$.createdAt").isString())
                .andExpect(jsonPath("$.updatedAt").isString())
                .andExpect(jsonPath("$.businessId").doesNotExist());
    }

    @Test
    void searchMatchesNameOrTagCaseInsensitively() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        insertItem(business, "Flower Print", 10, 1200, "print");
        insertItem(business, "Cat Keychain", 5, 800, "Charm");
        insertItem(business, "100% Cotton Tote", 3, 2000, "bag");

        mockMvc.perform(get("/api/items?search=FLOWER").cookie(cookie))
                .andExpect(jsonPath("$.data[*].name", contains("Flower Print")));
        mockMvc.perform(get("/api/items?search=charm").cookie(cookie))
                .andExpect(jsonPath("$.data[*].name", contains("Cat Keychain")));
        // "%" is matched literally, not as a wildcard that matches everything.
        mockMvc.perform(get("/api/items").param("search", "%").cookie(cookie))
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.data[*].name", contains("100% Cotton Tote")));
    }

    @Test
    void sortsByQuantityDescending() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        insertItem(business, "Few", 1, 100);
        insertItem(business, "Many", 50, 100);
        insertItem(business, "Some", 7, 100);

        mockMvc.perform(get("/api/items?sort=quantity&order=desc").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].name", contains("Many", "Some", "Few")));
    }

    @Test
    void invalidListParametersFailValidation() throws Exception {
        Cookie cookie = registerAndLogin();

        mockMvc.perform(get("/api/items?pageSize=500").cookie(cookie))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Validation failed"))
                .andExpect(jsonPath("$.error.details[0].field").value("pageSize"));
        mockMvc.perform(get("/api/items?sort=price;DROP TABLE items").cookie(cookie))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].field").value("sort"));
    }

    @Test
    void invalidIdIsRejected() throws Exception {
        Cookie cookie = registerAndLogin();

        mockMvc.perform(get("/api/items/abc").cookie(cookie))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Invalid item id: \"abc\""));
    }

    @Test
    void anotherBusinesssItemIsNotFoundAndNotListed() throws Exception {
        Cookie owner = registerAndLogin();
        int othersItem = insertItem(businessId(owner), "Secret Item", 1, 100);
        Cookie someoneElse = registerAndLogin();

        mockMvc.perform(get("/api/items/" + othersItem).cookie(someoneElse))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.message").value("Item " + othersItem + " not found"));
        mockMvc.perform(get("/api/items").cookie(someoneElse))
                .andExpect(jsonPath("$.data[*].id", not(hasItem(othersItem))));
    }

    @Test
    void withoutLoginIsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/items"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.message").value("Log in to continue"));
    }

    @Test
    void unknownApiRouteIsNotFound() throws Exception {
        Cookie cookie = registerAndLogin();

        mockMvc.perform(get("/api/nonexistent").cookie(cookie))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.message").value("Route GET /api/nonexistent not found"));
    }
}
