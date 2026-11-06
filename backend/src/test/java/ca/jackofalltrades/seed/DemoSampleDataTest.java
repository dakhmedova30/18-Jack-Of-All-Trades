package ca.jackofalltrades.seed;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.greaterThan;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ca.jackofalltrades.PostgresTestBase;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.context.SecurityContextHolder;

/** The demo account's sample data: added once, only to an empty business, and only to that business. */
class DemoSampleDataTest extends PostgresTestBase {

    private static final int ITEMS = 8;
    private static final int SALES = 20;
    /** 6 restocks and 6 plain costs. */
    private static final int EXPENSES = 12;

    @Autowired
    private DemoSampleData sampleData;

    @Autowired
    private JdbcClient jdbcClient;

    private int count(String table, int businessId) {
        return jdbcClient.sql("SELECT count(*) FROM " + table + " WHERE business_id = :b")
                .param("b", businessId).query(Integer.class).single();
    }

    private void expectCounts(int businessId, int items, int sales, int expenses) {
        assertThat(count("items", businessId)).as("items").isEqualTo(items);
        assertThat(count("sales", businessId)).as("sales").isEqualTo(sales);
        assertThat(count("expenses", businessId)).as("expenses").isEqualTo(expenses);
    }

    @Test
    void fillsAnEmptyBusinessThroughTheServices() throws Exception {
        Cookie cookie = registerAndLogin();
        int businessId = businessId(cookie);

        assertThat(sampleData.addIfEmpty(businessId)).isTrue();
        // It acted as the business only while seeding (checked before MockMvc resets the context).
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();

        expectCounts(businessId, ITEMS, SALES, EXPENSES);
        // Restocks added stock and sales took it, and nothing went below zero.
        assertThat(jdbcClient.sql("SELECT min(quantity) FROM items WHERE business_id = :b")
                .param("b", businessId).query(Integer.class).single()).isGreaterThanOrEqualTo(0);
        mockMvc.perform(get("/api/items/low-stock").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].name", containsInAnyOrder("Floral Tote Bag", "Custom Pet Portrait")));
        // Home's default period is never empty.
        mockMvc.perform(get("/api/analytics/summary?range=month").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalRevenueCents", greaterThan(0)))
                .andExpect(jsonPath("$.totalExpensesCents", greaterThan(0)));
    }

    @Test
    void addsNothingTheSecondTime() throws Exception {
        int businessId = businessId(registerAndLogin());

        assertThat(sampleData.addIfEmpty(businessId)).isTrue();
        assertThat(sampleData.addIfEmpty(businessId)).isFalse();

        expectCounts(businessId, ITEMS, SALES, EXPENSES);
    }

    @Test
    void leavesABusinessThatHasItemsAlone() throws Exception {
        Cookie cookie = registerAndLogin();
        int businessId = businessId(cookie);
        mockMvc.perform(post("/api/items").cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Mug", "quantity": 3, "unitPriceCents": 1200}
                                """))
                .andExpect(status().isCreated());

        assertThat(sampleData.addIfEmpty(businessId)).isFalse();

        expectCounts(businessId, 1, 0, 0);
    }

    @Test
    void touchesNoOtherBusiness() throws Exception {
        int seeded = businessId(registerAndLogin());
        int other = businessId(registerAndLogin());

        sampleData.addIfEmpty(seeded);

        expectCounts(seeded, ITEMS, SALES, EXPENSES);
        expectCounts(other, 0, 0, 0);
    }

    @Test
    void datesSalesThisMonthAndNeverInTheFutureEvenOnTheFirst() throws Exception {
        int businessId = businessId(registerAndLogin());
        Instant monthStart = Instant.parse("2026-03-01T00:00:00Z");
        Instant now = monthStart.plusSeconds(30);

        sampleData.addIfEmpty(businessId, now);

        int thisMonth = jdbcClient.sql("""
                        SELECT count(*) FROM sales WHERE business_id = :b AND sold_at >= :start AND sold_at <= :now
                        """)
                .param("b", businessId)
                .param("start", OffsetDateTime.ofInstant(monthStart, ZoneOffset.UTC))
                .param("now", OffsetDateTime.ofInstant(now, ZoneOffset.UTC))
                .query(Integer.class).single();
        assertThat(thisMonth).isEqualTo(3);
        for (String sql : new String[] {
                "SELECT count(*) FROM sales WHERE business_id = :b AND sold_at > :now",
                "SELECT count(*) FROM expenses WHERE business_id = :b AND incurred_at > :now"}) {
            assertThat(jdbcClient.sql(sql)
                    .param("b", businessId)
                    .param("now", OffsetDateTime.ofInstant(now, ZoneOffset.UTC))
                    .query(Integer.class).single()).as(sql).isZero();
        }
        // About six weeks of history before that.
        OffsetDateTime oldest = jdbcClient.sql("SELECT min(sold_at) FROM sales WHERE business_id = :b")
                .param("b", businessId).query(OffsetDateTime.class).single();
        assertThat(oldest.toInstant()).isBefore(monthStart.minusSeconds(40L * 24 * 3600));
    }
}
