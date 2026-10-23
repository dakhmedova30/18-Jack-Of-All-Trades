package ca.jackofalltrades.analytics;

import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * The buckets a summary {@code range} covers (contract §6), as the demo's summaryWindowFor.
 * All days and months are UTC, oldest first; labels are English whatever the server locale.
 *
 * @param granularity "day" or "month"
 */
record AnalyticsWindow(String granularity, List<Bucket> buckets) {

    /** @param key "YYYY-MM-DD" or "YYYY-MM"; @param start the bucket's first instant */
    record Bucket(String key, String label, Instant start) {}

    static final String DEFAULT_RANGE = "12months";

    /** @param range one of week, month, ytd, 12months */
    static AnalyticsWindow forRange(String range, Instant now) {
        LocalDate today = LocalDate.ofInstant(now, ZoneOffset.UTC);
        return switch (range) {
            case "week" -> days(today, 7, false);
            case "month" -> days(today, today.getDayOfMonth(), true);
            case "ytd" -> months(today, today.getMonthValue());
            case "12months" -> months(today, 12);
            default -> throw new IllegalArgumentException("Unknown range: " + range);
        };
    }

    /** The first instant of the window; everything from here on counts, as in the demo. */
    Instant start() {
        return buckets.getFirst().start();
    }

    /** {@code count} days ending today, labelled "Mon" or, for month-to-date, "13". */
    private static AnalyticsWindow days(LocalDate today, int count, boolean dayOfMonthLabels) {
        List<Bucket> buckets = new ArrayList<>();
        for (int i = count - 1; i >= 0; i--) {
            LocalDate day = today.minusDays(i);
            String label = dayOfMonthLabels
                    ? String.valueOf(day.getDayOfMonth())
                    : day.getDayOfWeek().getDisplayName(TextStyle.SHORT, Locale.ENGLISH);
            buckets.add(new Bucket(day.toString(), label, day.atStartOfDay(ZoneOffset.UTC).toInstant()));
        }
        return new AnalyticsWindow("day", buckets);
    }

    /** {@code count} calendar months ending this month, labelled "Jan". */
    private static AnalyticsWindow months(LocalDate today, int count) {
        List<Bucket> buckets = new ArrayList<>();
        for (int i = count - 1; i >= 0; i--) {
            YearMonth month = YearMonth.from(today).minusMonths(i);
            buckets.add(new Bucket(month.toString(), month.getMonth().getDisplayName(TextStyle.SHORT, Locale.ENGLISH),
                    month.atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant()));
        }
        return new AnalyticsWindow("month", buckets);
    }
}
