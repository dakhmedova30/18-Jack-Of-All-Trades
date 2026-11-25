package ca.jackofalltrades.common.docs;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ca.jackofalltrades.PostgresTestBase;
import com.jayway.jsonpath.JsonPath;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import org.junit.jupiter.api.Test;

class ApiDocsTest extends PostgresTestBase {

    /** The only operations that work without logging in. A new public endpoint must be added here on purpose. */
    private static final Set<String> PUBLIC_OPERATIONS = Set.of(
            "GET /api/health",
            "GET /api/health/live",
            "POST /api/auth/register",
            "POST /api/auth/login",
            "POST /api/auth/logout",
            "GET /api/public/businesses/{slug}",
            "GET /api/public/businesses/{slug}/logo",
            "GET /api/public/businesses/{slug}/items/{itemId}/photo");

    @Test
    void specIsReadableWithoutLoggingInAndOnlyCoversTheApi() throws Exception {
        Map<String, Object> paths = JsonPath.read(apiDocs(), "$.paths");

        assertThat(paths).containsKeys("/api/items", "/api/sales", "/api/expenses", "/api/analytics/summary");
        assertThat(paths.keySet()).allMatch(path -> path.startsWith("/api/"));
    }

    @Test
    void exactlyThePublicEndpointsAreDocumentedAsNeedingNoLogin() throws Exception {
        String spec = apiDocs();
        Set<String> documentedPublic = new TreeSet<>();
        Map<String, Map<String, Map<String, Object>>> paths = JsonPath.read(spec, "$.paths");
        paths.forEach((path, operations) -> operations.forEach((method, operation) -> {
            String name = method.toUpperCase() + " " + path;
            List<?> security = (List<?>) operation.get("security");
            if (security != null && security.isEmpty()) {
                documentedPublic.add(name);
            } else {
                // Everything else needs the session cookie, and says it can answer 401.
                assertThat(security).as(name).isNull();
                assertThat(((Map<?, ?>) operation.get("responses")).containsKey("401")).as(name + " documents 401").isTrue();
            }
        }));

        assertThat(documentedPublic).containsExactlyInAnyOrderElementsOf(PUBLIC_OPERATIONS);
        assertThat((List<?>) JsonPath.read(spec, "$.security[0].sessionCookie")).isEmpty();
        assertThat((String) JsonPath.read(spec, "$.components.securitySchemes.sessionCookie.name"))
                .isEqualTo("jack_session");
    }

    @Test
    void meIsDocumentedAsNeedingALoginEvenThoughSecurityConfigLetsAllOfAuthThrough() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.paths['/api/auth/me'].get.security").doesNotExist())
                .andExpect(jsonPath("$.paths['/api/auth/me'].get.responses['401'].content['application/json']"
                        + ".schema.$ref").value("#/components/schemas/ApiError"));
    }

    @Test
    void endpointsAreGroupedUnderReadableTags() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.paths['/api/items'].get.tags[0]").value("Inventory"))
                .andExpect(jsonPath("$.paths['/api/auth/login'].post.tags[0]").value("Account"));
    }

    @Test
    void swaggerUiIsServedWithoutLoggingIn() throws Exception {
        mockMvc.perform(get("/swagger-ui.html"))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrl("/swagger-ui/index.html"));
        mockMvc.perform(get("/swagger-ui/index.html")).andExpect(status().isOk());
    }

    private String apiDocs() throws Exception {
        return mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
    }
}
