package ca.jackofalltrades.common.health;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ca.jackofalltrades.PostgresTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.test.json.JsonCompareMode;

class HealthControllerTest extends PostgresTestBase {

    @Test
    void healthIsOkWithoutLoggingIn() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(content().json("""
                        {"status": "ok", "database": "ok"}
                        """, JsonCompareMode.STRICT));
    }
}
