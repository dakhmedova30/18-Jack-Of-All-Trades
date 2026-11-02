package ca.jackofalltrades.analytics;

import java.time.LocalDate;

/**
 * The {@code GET /api/analytics/date-range} JSON (contract §6): the first and last day with a
 * sale or expense (both null when there are none), the two ends of the date filter's slider.
 * {@code today} is the server's UTC date, so the client needn't rely on its own clock.
 */
public record AnalyticsDateRange(LocalDate firstDate, LocalDate lastDate, LocalDate today) {}
