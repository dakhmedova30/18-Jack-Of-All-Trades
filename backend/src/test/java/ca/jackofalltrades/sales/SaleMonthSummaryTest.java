package ca.jackofalltrades.sales;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ca.jackofalltrades.PostgresTestBase;
import jakarta.servlet.http.Cookie;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;

/**
 * Contract §4: GET /api/sales/month-summary for the current UTC month. Uses the real clock, so
 * a run that crosses midnight at the end of a month could see the wrong month.
 */
class SaleMonthSummaryTest extends PostgresTestBase {

    private static final OffsetDateTime MONTH_START =
            LocalDate.now(ZoneOffset.UTC).withDayOfMonth(1).atStartOfDay().atOffset(ZoneOffset.UTC);

    @Autowired
    private JdbcClient jdbcClient;

    /** Inserts a sale with one line totalling {@code totalCents}, and returns its id. */
    private int insertSale(int businessId, OffsetDateTime soldAt, int totalCents) {
        int saleId = jdbcClient.sql("""
                        INSERT INTO sales (business_id, sold_at, channel_id)
                        VALUES (:b, :soldAt, (SELECT MIN(id) FROM channels WHERE business_id = :b)) RETURNING id
                        """)
                .param("b", businessId).param("soldAt", soldAt)
                .query(Integer.class).single();
        jdbcClient.sql("""
                        INSERT INTO sale_items (sale_id, item_name, quantity, unit_price_cents, total_cents)
                        VALUES (:sale, 'Thing', 1, :total, :total)
                        """)
                .param("sale", saleId).param("total", totalCents)
                .update();
        return saleId;
    }

    @Test
    void requiresLogin() throws Exception {
        mockMvc.perform(get("/api/sales/month-summary")).andExpect(status().isUnauthorized());
    }

    @Test
    void noSalesGivesZerosAndNull() throws Exception {
        Cookie cookie = registerAndLogin();

        mockMvc.perform(get("/api/sales/month-summary").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.periodStart").value(MONTH_START.toInstant().toString()))
                .andExpect(jsonPath("$.periodEnd").value(MONTH_START.plusMonths(1).toInstant().toString()))
                .andExpect(jsonPath("$.saleCount").value(0))
                .andExpect(jsonPath("$.revenueCents").value(0))
                .andExpect(jsonPath("$.averageSaleCents").value(0))
                .andExpect(jsonPath("$.largestSale").isEmpty());
    }

    @Test
    void countsOnlyThisMonthsSalesOfThisBusiness() throws Exception {
        Cookie mine = registerAndLogin();
        Cookie theirs = registerAndLogin();
        int business = businessId(mine);
        insertSale(business, MONTH_START, 100);
        int largest = insertSale(business, MONTH_START.plusDays(1), 201);
        insertSale(business, MONTH_START.minusSeconds(1), 5000);         // last month
        insertSale(business, MONTH_START.plusMonths(1), 5000);           // next month
        insertSale(businessId(theirs), MONTH_START.plusHours(1), 5000);  // another business

        mockMvc.perform(get("/api/sales/month-summary").cookie(mine))
                .andExpect(jsonPath("$.saleCount").value(2))
                .andExpect(jsonPath("$.revenueCents").value(301))
                .andExpect(jsonPath("$.averageSaleCents").value(151))   // 150.5 rounds up
                .andExpect(jsonPath("$.largestSale.id").value(largest))
                .andExpect(jsonPath("$.largestSale.soldAt").value(MONTH_START.plusDays(1).toInstant().toString()))
                .andExpect(jsonPath("$.largestSale.totalCents").value(201));
    }
}
