package ca.jackofalltrades.analytics;

import jakarta.validation.constraints.Pattern;
import java.time.Instant;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Analytics endpoints (contract §6). No {@code @Validated}, for the reason given on ItemController. */
@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    /** The whole dashboard; {@code range} is the page's "Show by" filter. */
    @GetMapping("/summary")
    public AnalyticsSummary summary(
            @RequestParam(defaultValue = AnalyticsWindow.DEFAULT_RANGE)
            @Pattern(regexp = "week|month|ytd|12months", message = "Must be one of week, month, ytd, 12months")
            String range) {
        return analyticsService.summary(range, Instant.now());
    }

    /** Current stock by first tag; a snapshot, so {@code range} doesn't apply. */
    @GetMapping("/inventory")
    public InventoryByTag inventory() {
        return analyticsService.inventory();
    }
}
