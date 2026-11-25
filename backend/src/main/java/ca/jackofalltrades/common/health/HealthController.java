package ca.jackofalltrades.common.health;

import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Health checks (contract §7). No login required. */
@Tag(name = "Health", description = "Whether the app and its database are up. No login needed.")
@SecurityRequirements // public: no login needed
@RestController
public class HealthController {

    record HealthResponse(String status, String database) {}

    record LiveResponse(String status) {}

    private final JdbcTemplate jdbcTemplate;

    public HealthController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /** {@code GET /api/health}: the app and its database. For people checking on the app. */
    @GetMapping("/api/health")
    public ResponseEntity<HealthResponse> health() {
        try {
            jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            return ResponseEntity.ok(new HealthResponse("ok", "ok"));
        } catch (DataAccessException ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(new HealthResponse("error", "unreachable"));
        }
    }

    /**
     * {@code GET /api/health/live}: the app is running; never touches the database. Render uses it
     * as its health check, which runs every few seconds: a query here would keep Neon's compute
     * awake around the clock instead of letting it scale to zero when nobody is using the app.
     */
    @GetMapping("/api/health/live")
    public LiveResponse live() {
        return new LiveResponse("ok");
    }
}
