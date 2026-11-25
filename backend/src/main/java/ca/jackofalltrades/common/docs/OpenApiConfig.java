package ca.jackofalltrades.common.docs;

import ca.jackofalltrades.common.api.ApiError;
import io.swagger.v3.core.converter.ModelConverters;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * API docs: the OpenAPI spec at /v3/api-docs and Swagger UI at /swagger-ui.html, both readable
 * without logging in (SecurityConfig only guards /api/**). Set API_DOCS_ENABLED=false to turn them off.
 *
 * <p>Every endpoint is documented as needing the session cookie unless it is annotated with an
 * empty {@code @SecurityRequirements()} (health, register, login, logout, the public profile).
 * This is spelled out per endpoint instead of copied from SecurityConfig, because SecurityConfig
 * lets all of /api/auth/** through and the /api/auth/me endpoints check the login themselves.
 */
@Configuration
public class OpenApiConfig {

    static final String SESSION_COOKIE = "sessionCookie";

    @Bean
    OpenAPI openApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("Jack-Of-All-Trades API")
                        .version("v1")
                        .description("""
                                Inventory, sales, expenses and analytics for small creative businesses.

                                **Trying it out:** call `POST /api/auth/login` (or `/api/auth/register`) here \
                                first. The response sets the `jack_session` cookie in this browser, and later \
                                requests send it automatically. The Authorize button isn't needed.

                                **Conventions:** money is in integer cents (`unitPriceCents: 1250` is 12.50), \
                                dates are ISO 8601, lists are paginated with `page` and `pageSize`, and errors \
                                look like `{"error": {"message": "...", "details": [{"field": "...", \
                                "message": "..."}]}}`. The full contract is docs/api-contracts.md in the repository.
                                """))
                .components(new Components().addSecuritySchemes(SESSION_COOKIE, new SecurityScheme()
                        .type(SecurityScheme.Type.APIKEY)
                        .in(SecurityScheme.In.COOKIE)
                        .name("jack_session")
                        .description("Set by POST /api/auth/login or /api/auth/register.")))
                .addSecurityItem(new SecurityRequirement().addList(SESSION_COOKIE));
    }

    /**
     * Spring Security answers 401 before a controller runs, so springdoc can't see it. This adds
     * it, with the ApiError body, to every endpoint that needs a login.
     */
    @Bean
    OpenApiCustomizer unauthorizedResponses() {
        return openApi -> {
            ModelConverters.getInstance().readAll(ApiError.class).forEach(openApi.getComponents()::addSchemas);
            ApiResponse unauthorized = new ApiResponse()
                    .description("Not logged in")
                    .content(new Content().addMediaType(
                            org.springframework.http.MediaType.APPLICATION_JSON_VALUE,
                            new MediaType().schema(new Schema<>().$ref("#/components/schemas/ApiError"))));
            openApi.getPaths().values().forEach(path -> path.readOperations().stream()
                    // null means the global session-cookie requirement applies; [] means public.
                    .filter(operation -> operation.getSecurity() == null)
                    .forEach(operation -> operation.getResponses().putIfAbsent("401", unauthorized)));
        };
    }
}
