package ca.jackofalltrades.expenses;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ca.jackofalltrades.PostgresTestBase;
import jakarta.servlet.http.Cookie;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;

/** Contract §5: GET /api/expenses (search, sort, paging) and GET /api/expenses/{id}. */
class ExpenseReadTest extends PostgresTestBase {

    @Autowired
    private JdbcClient jdbcClient;

    /** Inserts an expense with one plain-cost line (cost 100 × quantity) directly, and returns its id. */
    private int insertExpense(int businessId, String incurredAt, String description, String lineName,
            int quantity, String... tags) {
        int expenseId = jdbcClient.sql("""
                        INSERT INTO expenses (business_id, incurred_at, description, tags)
                        VALUES (:b, :incurredAt, :description, :tags) RETURNING id
                        """)
                .param("b", businessId)
                .param("incurredAt", OffsetDateTime.parse(incurredAt))
                .param("description", description)
                .param("tags", tags)
                .query(Integer.class).single();
        jdbcClient.sql("""
                        INSERT INTO expense_items (expense_id, item_id, item_name, quantity, unit_cost_cents, total_cents)
                        VALUES (:expense, NULL, :name, :quantity, 100, :total)
                        """)
                .param("expense", expenseId).param("name", lineName)
                .param("quantity", quantity).param("total", 100 * quantity)
                .update();
        return expenseId;
    }

    @Test
    void requiresLogin() throws Exception {
        mockMvc.perform(get("/api/expenses")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/expenses/1")).andExpect(status().isUnauthorized());
    }

    @Test
    void emptyListHasThePaginatedShape() throws Exception {
        Cookie cookie = registerAndLogin();

        mockMvc.perform(get("/api/expenses").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isEmpty())
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.pageSize").value(10))
                .andExpect(jsonPath("$.total").value(0))
                .andExpect(jsonPath("$.totalPages").value(1));
    }

    @Test
    void getReturnsTheExpenseJson() throws Exception {
        Cookie cookie = registerAndLogin();
        int id = insertExpense(businessId(cookie), "2026-10-10T08:00:00-04:00", "October rent", "Rent", 2, "rent");

        mockMvc.perform(get("/api/expenses/" + id).cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.incurredAt").value("2026-10-10T12:00:00Z"))
                .andExpect(jsonPath("$.description").value("October rent"))
                .andExpect(jsonPath("$.tags", contains("rent")))
                .andExpect(jsonPath("$.totalCents").value(200))
                .andExpect(jsonPath("$.items[0].id").isNumber())
                .andExpect(jsonPath("$.items[0].itemId").isEmpty())
                .andExpect(jsonPath("$.items[0].itemName").value("Rent"))
                .andExpect(jsonPath("$.items[0].quantity").value(2))
                .andExpect(jsonPath("$.items[0].unitCostCents").value(100))
                .andExpect(jsonPath("$.items[0].totalCents").value(200))
                .andExpect(jsonPath("$.createdAt").isString())
                .andExpect(jsonPath("$.updatedAt").isString())
                .andExpect(jsonPath("$.businessId").doesNotExist());
    }

    @Test
    void anotherBusinesssExpenseIsNotFoundAndNotListed() throws Exception {
        Cookie owner = registerAndLogin();
        int theirs = insertExpense(businessId(owner), "2026-10-10T08:00:00Z", "", "Secret", 1);
        Cookie someoneElse = registerAndLogin();

        mockMvc.perform(get("/api/expenses/" + theirs).cookie(someoneElse))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.message").value("Expense " + theirs + " not found"));
        mockMvc.perform(get("/api/expenses").cookie(someoneElse))
                .andExpect(jsonPath("$.data[*].id", not(hasItem(theirs))));
    }

    @Test
    void invalidIdIs400() throws Exception {
        Cookie cookie = registerAndLogin();

        mockMvc.perform(get("/api/expenses/abc").cookie(cookie))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Invalid expense id: \"abc\""));
    }

    @Test
    void listDefaultsToNewestFirstWithPaging() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int oldest = insertExpense(business, "2026-10-01T00:00:00Z", "", "A", 1);
        int newest = insertExpense(business, "2026-10-03T00:00:00Z", "", "C", 1);
        int middle = insertExpense(business, "2026-10-02T00:00:00Z", "", "B", 1);

        mockMvc.perform(get("/api/expenses?pageSize=2").cookie(cookie))
                .andExpect(jsonPath("$.data[*].id", contains(newest, middle)))
                .andExpect(jsonPath("$.total").value(3))
                .andExpect(jsonPath("$.totalPages").value(2));
        mockMvc.perform(get("/api/expenses?pageSize=2&page=2").cookie(cookie))
                .andExpect(jsonPath("$.data[*].id", contains(oldest)));
    }

    @Test
    void searchMatchesTagsDescriptionAndLineNames() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int tagged = insertExpense(business, "2026-10-01T00:00:00Z", "", "Thing", 1, "Utilities");
        int described = insertExpense(business, "2026-10-02T00:00:00Z", "Booth at the craft fair", "Fee", 1);
        int line = insertExpense(business, "2026-10-03T00:00:00Z", "", "Bubble Wrap", 1);
        insertExpense(business, "2026-10-04T00:00:00Z", "", "100% cotton", 1);

        mockMvc.perform(get("/api/expenses?search=utilities").cookie(cookie))
                .andExpect(jsonPath("$.data[*].id", contains(tagged)));
        mockMvc.perform(get("/api/expenses?search=CRAFT").cookie(cookie))
                .andExpect(jsonPath("$.data[*].id", contains(described)));
        mockMvc.perform(get("/api/expenses?search=bubble").cookie(cookie))
                .andExpect(jsonPath("$.data[*].id", contains(line)));
        // "%" is matched literally, not as a wildcard that matches everything.
        mockMvc.perform(get("/api/expenses").param("search", "%").cookie(cookie))
                .andExpect(jsonPath("$.total").value(1));
    }

    @Test
    void sortsByEachFieldWithUntaggedLast() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int a = insertExpense(business, "2026-10-01T00:00:00Z", "", "A", 3, "Beta");
        int b = insertExpense(business, "2026-10-02T00:00:00Z", "", "B", 1);
        int c = insertExpense(business, "2026-10-03T00:00:00Z", "", "C", 2, "alpha");

        mockMvc.perform(get("/api/expenses?sort=incurredAt&order=asc").cookie(cookie))
                .andExpect(jsonPath("$.data[*].id", contains(a, b, c)));
        mockMvc.perform(get("/api/expenses?sort=id&order=desc").cookie(cookie))
                .andExpect(jsonPath("$.data[*].id", contains(c, b, a)));
        mockMvc.perform(get("/api/expenses?sort=total&order=desc").cookie(cookie))
                .andExpect(jsonPath("$.data[*].id", contains(a, c, b)));
        mockMvc.perform(get("/api/expenses?sort=total&order=asc").cookie(cookie))
                .andExpect(jsonPath("$.data[*].id", contains(b, c, a)));
        mockMvc.perform(get("/api/expenses?sort=tags&order=asc").cookie(cookie))
                .andExpect(jsonPath("$.data[*].id", contains(c, a, b)));
        mockMvc.perform(get("/api/expenses?sort=tags&order=desc").cookie(cookie))
                .andExpect(jsonPath("$.data[*].id", contains(a, c, b)));
    }

    @Test
    void invalidSortIsAValidationError() throws Exception {
        Cookie cookie = registerAndLogin();

        mockMvc.perform(get("/api/expenses?sort=soldAt").cookie(cookie))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].field").value("sort"))
                .andExpect(jsonPath("$.error.details[0].message").value("Must be one of id, incurredAt, total, tags"));
    }
}
