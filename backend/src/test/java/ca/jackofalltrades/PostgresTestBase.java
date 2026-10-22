package ca.jackofalltrades;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Base for tests that call the API. All subclasses share one Spring context and one
 * Postgres 17 container (Testcontainers), so Flyway migrations are tested on every run.
 * Tests stay independent without cleaning the database: each one registers its own
 * business, and every query is scoped to the logged-in business.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
public abstract class PostgresTestBase {

    protected static final String SESSION_COOKIE = "jack_session";

    @Autowired
    protected MockMvc mockMvc;

    /** A new, unique email, so tests never collide. */
    protected static String uniqueEmail() {
        return "test-" + UUID.randomUUID() + "@example.com";
    }

    /** Registers a new business and returns its jack_session cookie, for {@code .cookie(...)}. */
    protected Cookie registerAndLogin() throws Exception {
        return register("Test Business", uniqueEmail(), "correct-horse");
    }

    protected Cookie register(String name, String email, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "%s", "email": "%s", "password": "%s"}
                                """.formatted(name, email, password)))
                .andExpect(status().isCreated())
                .andReturn();
        return sessionCookie(result);
    }

    /** The id of the business a cookie belongs to, for inserting test data directly. */
    protected int businessId(Cookie cookie) throws Exception {
        String body = mockMvc.perform(get("/api/auth/me").cookie(cookie))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    /** The jack_session cookie set by a response (Spring Session writes it as a raw Set-Cookie header). */
    protected static Cookie sessionCookie(MvcResult result) {
        String header = result.getResponse().getHeaders("Set-Cookie").stream()
                .filter(value -> value.startsWith(SESSION_COOKIE + "="))
                .findFirst()
                .orElse(null);
        assertThat(header).as("Set-Cookie header for " + SESSION_COOKIE).isNotNull();
        String value = header.substring(SESSION_COOKIE.length() + 1, header.indexOf(';'));
        return new Cookie(SESSION_COOKIE, value);
    }
}
