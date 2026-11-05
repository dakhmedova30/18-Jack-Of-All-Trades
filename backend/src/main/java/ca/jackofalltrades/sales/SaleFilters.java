package ca.jackofalltrades.sales;

import ca.jackofalltrades.common.api.BadRequestException;
import java.time.LocalDate;

/**
 * What the sales list is narrowed to (contract §4). Every field is optional; null means "any".
 * Dates are UTC calendar days, as the rest of the app shows them, and both ends are inclusive.
 *
 * @param search already trimmed; null for no search
 */
public record SaleFilters(String search, Integer channelId, LocalDate from, LocalDate to) {

    /** As far as a date input goes; a later year is a typo, and would overflow "the day after {@code to}". */
    static final int MAX_YEAR = 9999;

    public SaleFilters {
        requireYearInRange(from, "from");
        requireYearInRange(to, "to");
        if (from != null && to != null && from.isAfter(to)) {
            throw new BadRequestException("'from' must be on or before 'to'");
        }
    }

    private static void requireYearInRange(LocalDate date, String name) {
        if (date != null && (date.getYear() < 1 || date.getYear() > MAX_YEAR)) {
            throw new BadRequestException("'" + name + "' must be a date between the years 1 and " + MAX_YEAR);
        }
    }
}
