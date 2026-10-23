package ca.jackofalltrades.expenses;

import static org.hamcrest.Matchers.contains;
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
 * Contract §5: GET /api/expenses/month-breakdown for the current UTC month. Uses the real clock,
 * so a run that crosses midnight at the end of a month could see the wrong month.
 */
class ExpenseMonthBreakdownTest extends PostgresTestBase {

    private static final OffsetDateTime MONTH_START =
            LocalDate.now(ZoneOffset.UTC).withDayOfMonth(1).atStartOfDay().atOffset(ZoneOffset.UTC);

    @Autowired
    private JdbcClient jdbcClient;

    private int insertItem(int businessId, String name) {
        return jdbcClient.sql("INSERT INTO items (business_id, name) VALUES (:b, :name) RETURNING id")
                .param("b", businessId).param("name", name)
                .query(Integer.class).single();
    }

    /** Inserts an expense with one line; {@code itemId} null makes it a running cost. */
    private void insertExpense(int businessId, OffsetDateTime incurredAt, Integer itemId, int quantity,
            int totalCents) {
        int expenseId = jdbcClient.sql("INSERT INTO expenses (business_id, incurred_at) VALUES (:b, :at) RETURNING id")
                .param("b", businessId).param("at", incurredAt)
                .query(Integer.class).single();
        jdbcClient.sql("""
                        INSERT INTO expense_items (expense_id, item_id, item_name, quantity, unit_cost_cents, total_cents)
                        VALUES (:expense, :item, 'Line', :quantity, 0, :total)
                        """)
                .param("expense", expenseId).param("item", itemId)
                .param("quantity", quantity).param("total", totalCents)
                .update();
    }

    @Test
    void requiresLogin() throws Exception {
        mockMvc.perform(get("/api/expenses/month-breakdown")).andExpect(status().isUnauthorized());
    }

    @Test
    void noExpensesGivesZeros() throws Exception {
        Cookie cookie = registerAndLogin();

        mockMvc.perform(get("/api/expenses/month-breakdown").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.periodStart").value(MONTH_START.toInstant().toString()))
                .andExpect(jsonPath("$.periodEnd").value(MONTH_START.plusMonths(1).toInstant().toString()))
                .andExpect(jsonPath("$.restockCents").value(0))
                .andExpect(jsonPath("$.runningCents").value(0))
                .andExpect(jsonPath("$.totalCents").value(0))
                .andExpect(jsonPath("$.topRestockItems").isEmpty());
    }

    @Test
    void splitsThisMonthsSpendingAndRanksRestockedItems() throws Exception {
        Cookie mine = registerAndLogin();
        Cookie theirs = registerAndLogin();
        int business = businessId(mine);
        int print = insertItem(business, "Flower Print");
        int keychain = insertItem(business, "Keychain");
        int sticker = insertItem(business, "Sticker");
        insertExpense(business, MONTH_START, print, 100, 7500);
        insertExpense(business, MONTH_START.plusDays(2), print, 100, 7500);
        insertExpense(business, MONTH_START.plusDays(1), keychain, 10, 2000);
        insertExpense(business, MONTH_START.plusDays(1), sticker, 50, 2000);     // ties keychain: by name
        insertExpense(business, MONTH_START.plusDays(3), null, 1, 2500);         // running cost
        insertExpense(business, MONTH_START.minusSeconds(1), print, 1, 9999);    // last month
        insertExpense(business, MONTH_START.plusMonths(1), null, 1, 9999);       // next month
        int theirItem = insertItem(businessId(theirs), "Theirs");
        insertExpense(businessId(theirs), MONTH_START.plusHours(1), theirItem, 1, 9999);

        mockMvc.perform(get("/api/expenses/month-breakdown").cookie(mine))
                .andExpect(jsonPath("$.restockCents").value(19000))
                .andExpect(jsonPath("$.runningCents").value(2500))
                .andExpect(jsonPath("$.totalCents").value(21500))
                .andExpect(jsonPath("$.topRestockItems[*].name", contains("Flower Print", "Keychain", "Sticker")))
                .andExpect(jsonPath("$.topRestockItems[0].id").value(print))
                .andExpect(jsonPath("$.topRestockItems[0].units").value(200))
                .andExpect(jsonPath("$.topRestockItems[0].spentCents").value(15000));
    }

    @Test
    void listsAtMostFiveRestockedItems() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        for (int i = 1; i <= 6; i++) {
            insertExpense(business, MONTH_START.plusHours(i), insertItem(business, "Item " + i), 1, i * 100);
        }

        mockMvc.perform(get("/api/expenses/month-breakdown").cookie(cookie))
                .andExpect(jsonPath("$.topRestockItems[*].name",
                        contains("Item 6", "Item 5", "Item 4", "Item 3", "Item 2")));
    }

    @Test
    void aRestockWhoseItemWasDeletedCountsAsRunning() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int print = insertItem(business, "Flower Print");
        insertExpense(business, MONTH_START, print, 10, 1000);
        jdbcClient.sql("DELETE FROM items WHERE id = :id").param("id", print).update();

        mockMvc.perform(get("/api/expenses/month-breakdown").cookie(cookie))
                .andExpect(jsonPath("$.restockCents").value(0))
                .andExpect(jsonPath("$.runningCents").value(1000))
                .andExpect(jsonPath("$.topRestockItems").isEmpty());
    }
}
