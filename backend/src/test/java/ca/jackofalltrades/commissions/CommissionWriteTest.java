package ca.jackofalltrades.commissions;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ca.jackofalltrades.PostgresTestBase;
import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;

class CommissionWriteTest extends PostgresTestBase {

    @Autowired
    private JdbcClient jdbcClient;

    @Test
    void receivedDateAndTipArePersistedAndSummarizedSeparately() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int commissionChannel = jdbcClient.sql("SELECT id FROM channels WHERE business_id = :b AND name = 'Commission'")
                .param("b", business)
                .query(Integer.class)
                .single();
        int itemId = jdbcClient.sql("""
                        INSERT INTO items (business_id, name, quantity, unit_price_cents)
                        VALUES (:b, 'Custom portrait', 2, 1000) RETURNING id
                        """)
                .param("b", business)
                .query(Integer.class)
                .single();

        String commissionBody = """
                {"name":"Portrait","contact":"","request":"Blue background",
                 "receivedOn":"2026-10-12","deadline":"2026-10-30","tags":[]}
                """;
        String commissionJson = mockMvc.perform(post("/api/commissions").cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON).content(commissionBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.receivedOn").value("2026-10-12"))
                .andReturn().getResponse().getContentAsString();
        int commissionId = JsonPath.read(commissionJson, "$.id");

        mockMvc.perform(post("/api/sales").cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"soldAt":"2026-10-18T15:30:00-04:00","channelId":%d,"commissionId":%d,
                                 "items":[{"itemId":%d,"quantity":1}],"tipCents":200}
                                """.formatted(commissionChannel, commissionId, itemId)))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/commissions/" + commissionId).cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.receivedOn").value("2026-10-12"))
                .andExpect(jsonPath("$.revenueCents").value(1000))
                .andExpect(jsonPath("$.tipsCents").value(200))
                .andExpect(jsonPath("$.profitCents").value(1200));

        mockMvc.perform(post("/api/miscellaneous").cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Pop-up","receivedOn":"2026-10-14","tags":[]}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.receivedOn").value("2026-10-14"));
    }
}
