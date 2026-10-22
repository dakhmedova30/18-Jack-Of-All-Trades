package ca.jackofalltrades.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ca.jackofalltrades.PostgresTestBase;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

/** Contract §2: register, login, logout, me. */
class AuthControllerTest extends PostgresTestBase {

    private static String json(String email, String password) {
        return """
                {"email": "%s", "password": "%s"}
                """.formatted(email, password);
    }

    @Test
    void registerReturnsTheBusinessAndASessionCookie() throws Exception {
        String email = uniqueEmail();
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Allie's Prints", "email": "%s", "password": "correct-horse"}
                                """.formatted(email)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.name").value("Allie's Prints"))
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.createdAt").isString())
                .andExpect(jsonPath("$.passwordHash").doesNotExist())
                .andReturn();

        String setCookie = result.getResponse().getHeaders("Set-Cookie").stream()
                .filter(value -> value.startsWith(SESSION_COOKIE + "="))
                .findFirst()
                .orElseThrow();
        assertThat(setCookie).contains("HttpOnly").contains("SameSite=Lax").contains("Max-Age=2592000");
    }

    @Test
    void registeringTheSameEmailTwiceIsRejected() throws Exception {
        String email = uniqueEmail();
        register("First", email, "correct-horse");

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Second", "email": "%s", "password": "correct-horse"}
                                """.formatted(email)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("An account with that email already exists"));
    }

    @Test
    void emailIsTrimmedAndLowercased() throws Exception {
        String local = "Mixed-" + System.nanoTime();
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Shop", "email": "  %s@Example.COM ", "password": "correct-horse"}
                                """.formatted(local)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value(local.toLowerCase() + "@example.com"));
    }

    @Test
    void shortPasswordFailsValidationWithFieldDetails() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Shop", "email": "%s", "password": "seven77"}
                                """.formatted(uniqueEmail())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Validation failed"))
                .andExpect(jsonPath("$.error.details[0].field").value("password"))
                .andExpect(jsonPath("$.error.details[0].message").value("Password must be at least 8 characters"));
    }

    @Test
    void wrongPasswordIsRejected() throws Exception {
        String email = uniqueEmail();
        register("Shop", email, "correct-horse");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(email, "wrong-horse")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.message").value("Incorrect email or password"));
    }

    @Test
    void loginCookieWorksForMe() throws Exception {
        String email = uniqueEmail();
        register("Shop", email, "correct-horse");

        MvcResult login = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(email, "correct-horse")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email))
                .andReturn();

        mockMvc.perform(get("/api/auth/me").cookie(sessionCookie(login)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email));
    }

    @Test
    void meWithoutACookieIsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.message").value("Not logged in"));
    }

    @Test
    void logoutEndsTheSession() throws Exception {
        Cookie cookie = registerAndLogin();
        mockMvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/logout").cookie(cookie))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/auth/me").cookie(cookie))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.message").value("Not logged in"));
    }

    @Test
    void malformedJsonIsRejected() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\": "))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Request body is not valid JSON"))
                .andExpect(jsonPath("$.error.details").doesNotExist());
    }
}
