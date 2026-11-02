package ca.jackofalltrades.notifications;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The alerts that apply right now, and the settings that decide which ones there are. */
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public List<NotificationAlert> alerts(@RequestHeader(value = "User-Agent", required = false) String userAgent) {
        return notificationService.alerts(userAgent);
    }

    @GetMapping("/settings")
    public NotificationSettings settings() {
        return notificationService.settings();
    }

    /** Replaces all the settings. The business's low-stock number is changed on {@code PATCH /api/auth/me}. */
    @PutMapping("/settings")
    public NotificationSettings saveSettings(@Valid @RequestBody NotificationSettings settings) {
        return notificationService.saveSettings(settings);
    }
}
