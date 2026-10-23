package ca.jackofalltrades.analytics;

import static org.assertj.core.api.Assertions.assertThat;

import ca.jackofalltrades.analytics.AnalyticsWindow.Bucket;
import java.time.Instant;
import org.junit.jupiter.api.Test;

/** Plain unit tests (no Spring) for the summary ranges, on fixed dates. */
class AnalyticsWindowTest {

    private static final Instant FRI_OCT_23 = Instant.parse("2026-10-23T15:30:00Z");

    @Test
    void weekIsTheLastSevenDaysWithWeekdayLabels() {
        AnalyticsWindow window = AnalyticsWindow.forRange("week", FRI_OCT_23);

        assertThat(window.granularity()).isEqualTo("day");
        assertThat(window.buckets()).extracting(Bucket::key).containsExactly(
                "2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23");
        assertThat(window.buckets()).extracting(Bucket::label)
                .containsExactly("Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri");
        assertThat(window.start()).isEqualTo(Instant.parse("2026-10-17T00:00:00Z"));
    }

    @Test
    void monthIsEachDaySoFarWithDayNumbers() {
        AnalyticsWindow window = AnalyticsWindow.forRange("month", FRI_OCT_23);

        assertThat(window.granularity()).isEqualTo("day");
        assertThat(window.buckets()).hasSize(23);
        assertThat(window.buckets().getFirst()).isEqualTo(
                new Bucket("2026-10-01", "1", Instant.parse("2026-10-01T00:00:00Z")));
        assertThat(window.buckets().getLast().label()).isEqualTo("23");
        // On the 1st, month-to-date is just today.
        assertThat(AnalyticsWindow.forRange("month", Instant.parse("2026-11-01T00:00:00Z")).buckets())
                .extracting(Bucket::key).containsExactly("2026-11-01");
    }

    @Test
    void ytdIsEachMonthSoFarThisYear() {
        AnalyticsWindow window = AnalyticsWindow.forRange("ytd", FRI_OCT_23);

        assertThat(window.granularity()).isEqualTo("month");
        assertThat(window.buckets()).extracting(Bucket::label).containsExactly(
                "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct");
        assertThat(window.start()).isEqualTo(Instant.parse("2026-01-01T00:00:00Z"));
        // In January, year-to-date is just this month.
        assertThat(AnalyticsWindow.forRange("ytd", Instant.parse("2027-01-15T00:00:00Z")).buckets())
                .extracting(Bucket::key).containsExactly("2027-01");
    }

    @Test
    void twelveMonthsEndsThisMonthAndCrossesTheYear() {
        AnalyticsWindow window = AnalyticsWindow.forRange("12months", FRI_OCT_23);

        assertThat(window.buckets()).hasSize(12);
        assertThat(window.buckets().getFirst()).isEqualTo(
                new Bucket("2025-11", "Nov", Instant.parse("2025-11-01T00:00:00Z")));
        assertThat(window.buckets().getLast().key()).isEqualTo("2026-10");
    }
}
