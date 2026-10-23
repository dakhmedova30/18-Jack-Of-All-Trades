package ca.jackofalltrades.expensetags;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ca.jackofalltrades.PostgresTestBase;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/** Contract §5.1: GET and POST /api/expense-tags, scoped to the logged-in business. */
class ExpenseTagControllerTest extends PostgresTestBase {

    private ResultActions create(Cookie cookie, String json) throws Exception {
        return mockMvc.perform(post("/api/expense-tags").cookie(cookie)
                .contentType(MediaType.APPLICATION_JSON).content(json));
    }

    @Test
    void requiresLogin() throws Exception {
        mockMvc.perform(get("/api/expense-tags"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.message").value("Log in to continue"));
    }

    @Test
    void newBusinessStartsWithTheStarterTags() throws Exception {
        Cookie cookie = registerAndLogin();

        mockMvc.perform(get("/api/expense-tags").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].name", contains("supplier", "supplies", "rent", "utilities", "market")))
                .andExpect(jsonPath("$[0].id").isNumber())
                .andExpect(jsonPath("$[0].businessId").doesNotExist());
    }

    @Test
    void createTrimsTheNameAndAppendsIt() throws Exception {
        Cookie cookie = registerAndLogin();

        create(cookie, "{\"name\": \"  shipping  \"}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.name").value("shipping"));
        mockMvc.perform(get("/api/expense-tags").cookie(cookie))
                .andExpect(jsonPath("$[*].name",
                        contains("supplier", "supplies", "rent", "utilities", "market", "shipping")));
    }

    @Test
    void duplicateNameIgnoringCaseIs409() throws Exception {
        Cookie cookie = registerAndLogin();

        create(cookie, "{\"name\": \"Rent\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.message").value("Tag \"Rent\" already exists"));
    }

    @Test
    void sameNameIsFineForAnotherBusiness() throws Exception {
        Cookie mine = registerAndLogin();
        Cookie theirs = registerAndLogin();
        create(theirs, "{\"name\": \"shipping\"}").andExpect(status().isCreated());

        create(mine, "{\"name\": \"shipping\"}").andExpect(status().isCreated());
        mockMvc.perform(get("/api/expense-tags").cookie(theirs))
                .andExpect(jsonPath("$[*].name",
                        contains("supplier", "supplies", "rent", "utilities", "market", "shipping")));
    }

    @Test
    void invalidNamesAreValidationErrors() throws Exception {
        Cookie cookie = registerAndLogin();

        create(cookie, "{\"name\": \"   \"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Validation failed"))
                .andExpect(jsonPath("$.error.details[0].field").value("name"))
                .andExpect(jsonPath("$.error.details[0].message").value("Name is required"));
        create(cookie, "{\"name\": \"" + "x".repeat(31) + "\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].message").value("Name must be at most 30 characters"));
        mockMvc.perform(get("/api/expense-tags").cookie(cookie))
                .andExpect(jsonPath("$[*].name", not(hasItem("   "))));
    }
}
