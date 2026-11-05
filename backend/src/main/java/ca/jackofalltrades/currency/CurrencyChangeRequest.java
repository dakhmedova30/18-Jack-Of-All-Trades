package ca.jackofalltrades.currency;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Locale;

public record CurrencyChangeRequest(
        @NotNull(message = "Currency is required")
        @Size(min = 3, max = 3, message = "Currency must be a 3-letter code")
        String currency,
        @NotNull(message = "Choose whether to convert product prices")
        Boolean convertPrices) {

    public CurrencyChangeRequest {
        currency = currency == null ? null : currency.strip().toUpperCase(Locale.ROOT);
    }
}
