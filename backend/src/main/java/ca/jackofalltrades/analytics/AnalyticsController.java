package ca.jackofalltrades.analytics;

import ca.jackofalltrades.common.api.BadRequestException;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import org.springframework.format.annotation.DateTimeFormat;
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

    /**
     * The whole dashboard, for a "Show by" {@code range} or for the period {@code from} to
     * {@code to} (ISO dates, both included). A period, when given, takes precedence over {@code range}.
     * {@code channelId} narrows the sales figures to one channel; expenses have no channel.
     */
    @GetMapping("/summary")
    public AnalyticsSummary summary(
            @RequestParam(defaultValue = AnalyticsWindow.DEFAULT_RANGE)
            @Pattern(regexp = "week|month|ytd|12months", message = "Must be one of week, month, ytd, 12months")
            String range,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false)
            @Min(value = 1, message = "Must be at least 1") Integer channelId) {
        if (from == null && to == null) {
            return analyticsService.summary(range, Instant.now(), channelId);
        }
        if (from == null || to == null) {
            throw new BadRequestException("Give both 'from' and 'to', or neither");
        }
        return analyticsService.summary(from, to, channelId);
    }

    /** The first and last day with a sale or expense: the two ends of the date filter's slider. */
    @GetMapping("/date-range")
    public AnalyticsDateRange dateRange() {
        return analyticsService.dateRange(LocalDate.now(ZoneOffset.UTC));
    }

    /** Current stock by first tag; a snapshot, so {@code range} doesn't apply. */
    @GetMapping("/inventory")
    public InventoryByTag inventory() {
        return analyticsService.inventory();
    }
}
