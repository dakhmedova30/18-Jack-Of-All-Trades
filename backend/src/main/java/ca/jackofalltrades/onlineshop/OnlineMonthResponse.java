package ca.jackofalltrades.onlineshop;

/** One month of the online shop ({@code month} is {@code YYYY-MM}), all amounts in {@code currency}. */
public record OnlineMonthResponse(
        String month,
        int salesCount,
        long expensesCents,
        long revenueCents,
        long profitCents,
        String currency) {}
