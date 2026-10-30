package ca.jackofalltrades.notifications;

import java.time.Instant;

/**
 * One alert that applies right now. {@code fingerprint} changes when the alert's situation does
 * (more items low, a different last sale), so the app can keep a dismissed alert hidden until then.
 * {@code userAgent} is only set for {@code new-device}; the app turns it into "Chrome on Windows".
 */
public record NotificationAlert(
        String type,
        String fingerprint,
        String title,
        String message,
        String link,
        String userAgent,
        Instant at) {}
