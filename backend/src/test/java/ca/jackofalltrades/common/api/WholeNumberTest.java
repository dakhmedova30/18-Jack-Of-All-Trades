package ca.jackofalltrades.common.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ca.jackofalltrades.PostgresTestBase;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Whole-number fields in request bodies (contract §1: ids, quantities and cents are whole
 * numbers) reject decimals and numbers sent as strings, instead of silently truncating them.
 * The rule is global (application.yml), so sales stand in for every module here.
 */
class WholeNumberTest extends PostgresTestBase {

    @Autowired
    private JdbcClient jdbcClient;

    private int business;
    private int channel;
    private int item;

    private Cookie setUp() throws Exception {
        Cookie cookie = registerAndLogin();
        business = businessId(cookie);
        channel = jdbcClient.sql("SELECT MIN(id) FROM channels WHERE business_id = :b")
                .param("b", business).query(Integer.class).single();
        item = jdbcClient.sql("""
                        INSERT INTO items (business_id, name, quantity, unit_price_cents)
                        VALUES (:b, 'Print', 10, 100) RETURNING id
                        """)
                .param("b", business).query(Integer.class).single();
        return cookie;
    }

    private ResultActions recordSale(Cookie cookie, String channelId, String itemId, String quantity)
            throws Exception {
        return mockMvc.perform(post("/api/sales").cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"soldAt": "2026-10-18T15:30:00-04:00", "channelId": %s,
                         "items": [{"itemId": %d, "quantity": 1}, {"itemId": %s, "quantity": %s}]}
                        """.formatted(channelId, item, itemId, quantity)));
    }

    private void expectFieldError(ResultActions result, String field) throws Exception {
        result.andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Validation failed"))
                .andExpect(jsonPath("$.error.details[0].field").value(field))
                .andExpect(jsonPath("$.error.details[0].message").value("Must be a whole number"));
    }

    private int stock() {
        return jdbcClient.sql("SELECT quantity FROM items WHERE id = :id").param("id", item)
                .query(Integer.class).single();
    }

    @Test
    void decimalsAreRejectedWithTheFieldPath() throws Exception {
        Cookie cookie = setUp();

        expectFieldError(recordSale(cookie, String.valueOf(channel), String.valueOf(item), "2.7"), "items.1.quantity");
        expectFieldError(recordSale(cookie, String.valueOf(channel), String.valueOf(item), "-0.5"), "items.1.quantity");
        expectFieldError(recordSale(cookie, String.valueOf(channel), item + ".4", "1"), "items.1.itemId");
        expectFieldError(recordSale(cookie, channel + ".9", String.valueOf(item), "1"), "channelId");

        assertThat(stock()).isEqualTo(10);
    }

    @Test
    void numbersSentAsStringsAreRejected() throws Exception {
        Cookie cookie = setUp();

        expectFieldError(recordSale(cookie, String.valueOf(channel), String.valueOf(item), "\"5\""), "items.1.quantity");
        expectFieldError(recordSale(cookie, "\"" + channel + "\"", String.valueOf(item), "1"), "channelId");

        assertThat(stock()).isEqualTo(10);
    }

    @Test
    void bulkDeleteIdsMustBeWholeNumbers() throws Exception {
        Cookie cookie = setUp();

        expectFieldError(mockMvc.perform(post("/api/sales/bulk-delete").cookie(cookie)
                .contentType(MediaType.APPLICATION_JSON).content("{\"ids\": [1, 6.5]}")), "ids.1");
    }

    @Test
    void wholeNumbersWrittenWithAZeroFractionAreStillAccepted() throws Exception {
        Cookie cookie = setUp();

        recordSale(cookie, String.valueOf(channel), String.valueOf(item), "2.0")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.items[1].quantity").value(2));
        assertThat(stock()).isEqualTo(7);
    }

    @Test
    void otherMalformedBodiesAreStillNotValidJson() throws Exception {
        Cookie cookie = setUp();

        mockMvc.perform(post("/api/sales").cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"soldAt\": "))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Request body is not valid JSON"));
        mockMvc.perform(post("/api/sales").cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"items\": 5}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Request body is not valid JSON"));
    }
}
