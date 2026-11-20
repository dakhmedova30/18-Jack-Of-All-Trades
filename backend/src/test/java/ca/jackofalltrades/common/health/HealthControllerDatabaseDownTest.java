package ca.jackofalltrades.common.health;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

/** No Spring context: the database is unreachable (nothing listens on port 1). */
class HealthControllerDatabaseDownTest {

    private final HealthController controller = new HealthController(
            new JdbcTemplate(new DriverManagerDataSource("jdbc:postgresql://127.0.0.1:1/unreachable")));

    @Test
    void healthReportsTheDatabaseUnreachable() {
        var response = controller.health();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getBody()).isEqualTo(new HealthController.HealthResponse("error", "unreachable"));
    }

    @Test
    void liveStaysOkBecauseItNeverUsesTheDatabase() {
        assertThat(controller.live()).isEqualTo(new HealthController.LiveResponse("ok"));
    }
}
