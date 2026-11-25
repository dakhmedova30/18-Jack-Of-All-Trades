package ca.jackofalltrades.common.health;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
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

    @Test
    void liveIsOkWithoutLoggingInOrStartingASession() throws Exception {
        // No session cookie: a session would be written to the database on every health check.
        mockMvc.perform(get("/api/health/live"))
                .andExpect(status().isOk())
                .andExpect(header().doesNotExist("Set-Cookie"))
                .andExpect(content().json("""
                        {"status": "ok"}
                        """, JsonCompareMode.STRICT));
    }
}
