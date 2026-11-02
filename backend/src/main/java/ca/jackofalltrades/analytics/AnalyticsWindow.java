package ca.jackofalltrades.analytics;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.format.TextStyle;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * The buckets a summary covers (contract §6): a "Show by" {@code range}, as the demo's
 * summaryWindowFor, or a chosen period. All days and months are UTC, oldest first; labels are
 * English whatever the server locale.
 *
 * @param granularity "day", "week" or "month"
 * @param end the first instant after the window, or null when it has no upper bound (the
 *     "Show by" ranges, which count everything from their start onward, as the demo)
 */
record AnalyticsWindow(String granularity, List<Bucket> buckets, Instant end) {

    /** @param key "YYYY-MM-DD" (a day, or a week's Monday) or "YYYY-MM"; @param start the bucket's first instant */
    record Bucket(String key, String label, Instant start) {}

    static final String DEFAULT_RANGE = "12months";

    /** Chosen periods up to this many days get one bucket per day. */
    static final int MAX_DAILY_DAYS = 31;
    /** Chosen periods up to this many days (about six months) get one bucket per week. */
    static final int MAX_WEEKLY_DAYS = 183;

    AnalyticsWindow(String granularity, List<Bucket> buckets) {
        this(granularity, buckets, null);
    }

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

    /**
     * The period {@code from} to {@code to}, both included. The bucket size follows its length:
     * days up to a month, weeks (from Monday) up to about six months, months beyond. The first
     * and last buckets may be partial; each starts where the period starts within it, and is
     * labelled with that day ("Oct 5") or month ("Oct", or "Oct 2025" when the period spans years).
     */
    static AnalyticsWindow between(LocalDate from, LocalDate to) {
        long days = ChronoUnit.DAYS.between(from, to) + 1;
        Instant end = startOf(to.plusDays(1));
        List<Bucket> buckets = new ArrayList<>();
        if (days <= MAX_DAILY_DAYS) {
            for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
                buckets.add(new Bucket(day.toString(), monthAndDay(day), startOf(day)));
            }
            return new AnalyticsWindow("day", buckets, end);
        }
        if (days <= MAX_WEEKLY_DAYS) {
            LocalDate monday = from.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            for (LocalDate week = monday; !week.isAfter(to); week = week.plusWeeks(1)) {
                LocalDate first = week.isBefore(from) ? from : week;
                buckets.add(new Bucket(week.toString(), monthAndDay(first), startOf(first)));
            }
            return new AnalyticsWindow("week", buckets, end);
        }
        boolean oneYear = from.getYear() == to.getYear();
        for (YearMonth month = YearMonth.from(from); !month.isAfter(YearMonth.from(to)); month = month.plusMonths(1)) {
            LocalDate first = month.atDay(1).isBefore(from) ? from : month.atDay(1);
            String label = shortMonth(month) + (oneYear ? "" : " " + month.getYear());
            buckets.add(new Bucket(month.toString(), label, startOf(first)));
        }
        return new AnalyticsWindow("month", buckets, end);
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
            buckets.add(new Bucket(month.toString(), shortMonth(month),
                    month.atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant()));
        }
        return new AnalyticsWindow("month", buckets);
    }

    private static Instant startOf(LocalDate day) {
        return day.atStartOfDay(ZoneOffset.UTC).toInstant();
    }

    private static String shortMonth(YearMonth month) {
        return month.getMonth().getDisplayName(TextStyle.SHORT, Locale.ENGLISH);
    }

    /** "Oct 5" */
    private static String monthAndDay(LocalDate day) {
        return shortMonth(YearMonth.from(day)) + " " + day.getDayOfMonth();
    }
}
