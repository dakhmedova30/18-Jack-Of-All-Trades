package ca.jackofalltrades.notifications;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * Which alerts a business wants and the numbers that trigger them: the {@code GET} response and
 * {@code PUT} body of {@code /api/notifications/settings}. The low-stock number lives on the
 * business ({@code lowStockThreshold}), not here.
 */
public record NotificationSettings(
        @NotNull(message = "Required") Boolean lowStock,
        @NotNull(message = "Required") Boolean outOfStock,
        @NotNull(message = "Required") Boolean newDevice,
        @NotNull(message = "Required") Boolean noSales,
        @NotNull(message = "Required")
        @Min(value = 1, message = "Must be at least 1 day")
        @Max(value = 365, message = "Must be at most 365 days")
        Integer noSalesDays,
        @NotNull(message = "Required") Boolean expenseSpike,
        @NotNull(message = "Required")
        @Min(value = 1, message = "Must be at least 1 percent")
        @Max(value = 1000, message = "Must be at most 1000 percent")
        Integer expenseSpikePercent) {

    /** What a business has until it saves its own. */
    public static final NotificationSettings DEFAULTS =
            new NotificationSettings(true, true, true, true, 3, true, 20);
}
