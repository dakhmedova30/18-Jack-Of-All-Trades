package ca.jackofalltrades.sales;

import static org.hamcrest.Matchers.contains;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ca.jackofalltrades.PostgresTestBase;
import jakarta.servlet.http.Cookie;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;

/** Contract §4: GET /api/sales (search, sort, paging) and GET /api/sales/{id}. */
class SaleReadTest extends PostgresTestBase {

    @Autowired
    private JdbcClient jdbcClient;

    private int channelId(int businessId, String name) {
        return jdbcClient.sql("SELECT id FROM channels WHERE business_id = :b AND name = :n")
                .param("b", businessId).param("n", name).query(Integer.class).single();
    }

    /** Inserts a sale with one line (price 100 × quantity) directly, and returns its id. */
    private int insertSale(int businessId, String soldAt, String channel, String description,
            String itemName, int quantity, String... tags) {
        int saleId = jdbcClient.sql("""
                        INSERT INTO sales (business_id, sold_at, channel_id, description, tags)
                        VALUES (:b, :soldAt, :channel, :description, :tags) RETURNING id
                        """)
                .param("b", businessId)
                .param("soldAt", OffsetDateTime.parse(soldAt))
                .param("channel", channelId(businessId, channel))
                .param("description", description)
                .param("tags", tags)
                .query(Integer.class).single();
        jdbcClient.sql("""
                        INSERT INTO sale_items (sale_id, item_id, item_name, quantity, unit_price_cents, total_cents)
                        VALUES (:sale, NULL, :name, :quantity, 100, :total)
                        """)
                .param("sale", saleId).param("name", itemName)
                .param("quantity", quantity).param("total", 100 * quantity)
                .update();
        return saleId;
    }

    @Test
    void requiresLogin() throws Exception {
        mockMvc.perform(get("/api/sales")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/sales/1")).andExpect(status().isUnauthorized());
    }

    @Test
    void emptyListHasThePaginatedShape() throws Exception {
        Cookie cookie = registerAndLogin();

        mockMvc.perform(get("/api/sales").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isEmpty())
                .andExpect(jsonPath("$.total").value(0))
                .andExpect(jsonPath("$.totalPages").value(1));
    }

    @Test
    void getReturnsTheSaleJson() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int id = insertSale(business, "2026-10-18T15:30:00-04:00", "Online", "Prints", "Flower Print", 2, "market");

        mockMvc.perform(get("/api/sales/" + id).cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.soldAt").value("2026-10-18T19:30:00Z"))
                .andExpect(jsonPath("$.channel.id").value(channelId(business, "Online")))
                .andExpect(jsonPath("$.channel.name").value("Online"))
                .andExpect(jsonPath("$.description").value("Prints"))
                .andExpect(jsonPath("$.tags", contains("market")))
                .andExpect(jsonPath("$.totalCents").value(200))
                .andExpect(jsonPath("$.items[0].itemId").isEmpty())
                .andExpect(jsonPath("$.items[0].itemName").value("Flower Print"))
                .andExpect(jsonPath("$.items[0].quantity").value(2))
                .andExpect(jsonPath("$.items[0].unitPriceCents").value(100))
                .andExpect(jsonPath("$.items[0].totalCents").value(200))
                .andExpect(jsonPath("$.createdAt").isString())
                .andExpect(jsonPath("$.updatedAt").isString())
                .andExpect(jsonPath("$.businessId").doesNotExist());
    }

    @Test
    void anotherBusinesssSaleIsNotFoundAndNotListed() throws Exception {
        Cookie mine = registerAndLogin();
        Cookie theirs = registerAndLogin();
        int theirSale = insertSale(businessId(theirs), "2026-10-18T12:00:00Z", "Online", "", "Secret", 1);

        mockMvc.perform(get("/api/sales/" + theirSale).cookie(mine))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.message").value("Sale " + theirSale + " not found"));
        mockMvc.perform(get("/api/sales").cookie(mine))
                .andExpect(jsonPath("$.total").value(0));
    }

    @Test
    void invalidIdIs400() throws Exception {
        Cookie cookie = registerAndLogin();

        mockMvc.perform(get("/api/sales/abc").cookie(cookie))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Invalid sale id: \"abc\""));
    }

    @Test
    void listDefaultsToNewestFirstWithPaging() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        insertSale(business, "2026-10-01T12:00:00Z", "Online", "", "A", 1);
        insertSale(business, "2026-10-03T12:00:00Z", "Online", "", "C", 1);
        insertSale(business, "2026-10-02T12:00:00Z", "Online", "", "B", 1);

        mockMvc.perform(get("/api/sales?pageSize=2").cookie(cookie))
                .andExpect(jsonPath("$.data[*].items[0].itemName", contains("C", "B")))
                .andExpect(jsonPath("$.total").value(3))
                .andExpect(jsonPath("$.totalPages").value(2));
        mockMvc.perform(get("/api/sales?pageSize=2&page=2").cookie(cookie))
                .andExpect(jsonPath("$.data[*].items[0].itemName", contains("A")));
    }

    @Test
    void searchMatchesTagsDescriptionChannelAndItemNames() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        insertSale(business, "2026-10-01T12:00:00Z", "Online", "", "Tagged", 1, "MARKET");
        insertSale(business, "2026-10-02T12:00:00Z", "Online", "Gift for Sam", "Described", 1);
        insertSale(business, "2026-10-03T12:00:00Z", "Commission", "", "Commissioned", 1);
        insertSale(business, "2026-10-04T12:00:00Z", "Online", "", "Flower Print", 1);
        insertSale(business, "2026-10-05T12:00:00Z", "Online", "", "100% Cotton", 1);

        mockMvc.perform(get("/api/sales?search=market").cookie(cookie))
                .andExpect(jsonPath("$.data[*].items[0].itemName", contains("Tagged")));
        mockMvc.perform(get("/api/sales?search=sam").cookie(cookie))
                .andExpect(jsonPath("$.data[*].items[0].itemName", contains("Described")));
        mockMvc.perform(get("/api/sales?search=commission").cookie(cookie))
                .andExpect(jsonPath("$.data[*].items[0].itemName", contains("Commissioned")));
        mockMvc.perform(get("/api/sales?search=flower").cookie(cookie))
                .andExpect(jsonPath("$.data[*].items[0].itemName", contains("Flower Print")));
        // "%" is matched literally, not as a wildcard.
        mockMvc.perform(get("/api/sales").param("search", "%").cookie(cookie))
                .andExpect(jsonPath("$.data[*].items[0].itemName", contains("100% Cotton")));
    }

    @Test
    void sortsByEachFieldWithUntaggedLast() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int small = insertSale(business, "2026-10-01T12:00:00Z", "Online", "", "Small", 1, "beta");
        int big = insertSale(business, "2026-10-02T12:00:00Z", "Commission", "", "Big", 5, "Alpha");
        int none = insertSale(business, "2026-10-03T12:00:00Z", "In person", "", "Untagged", 3);

        mockMvc.perform(get("/api/sales?sort=total&order=desc").cookie(cookie))
                .andExpect(jsonPath("$.data[*].id", contains(big, none, small)));
        mockMvc.perform(get("/api/sales?sort=total&order=asc").cookie(cookie))
                .andExpect(jsonPath("$.data[*].id", contains(small, none, big)));
        mockMvc.perform(get("/api/sales?sort=tags&order=asc").cookie(cookie))
                .andExpect(jsonPath("$.data[*].id", contains(big, small, none)));
        mockMvc.perform(get("/api/sales?sort=tags&order=desc").cookie(cookie))
                .andExpect(jsonPath("$.data[*].id", contains(small, big, none)));
        mockMvc.perform(get("/api/sales?sort=channel&order=asc").cookie(cookie))
                .andExpect(jsonPath("$.data[*].id", contains(big, none, small)));
        mockMvc.perform(get("/api/sales?sort=soldAt&order=asc").cookie(cookie))
                .andExpect(jsonPath("$.data[*].id", contains(small, big, none)));
        mockMvc.perform(get("/api/sales?sort=id&order=desc").cookie(cookie))
                .andExpect(jsonPath("$.data[*].id", contains(none, big, small)));
    }

    @Test
    void invalidSortIsAValidationError() throws Exception {
        Cookie cookie = registerAndLogin();

        mockMvc.perform(get("/api/sales?sort=price").cookie(cookie))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].field").value("sort"));
    }
}
