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

    public SaleFilters {
        if (from != null && to != null && from.isAfter(to)) {
            throw new BadRequestException("'from' must be on or before 'to'");
        }
    }
}
