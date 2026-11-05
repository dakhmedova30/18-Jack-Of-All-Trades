package ca.jackofalltrades.currency;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Map;

public record ExchangeRates(String baseCurrency, Map<String, BigDecimal> rates, LocalDate asOfDate, Instant refreshAt) {

    static ExchangeRates from(ExchangeRateResponse response) {
        if (response == null
                || !"success".equals(response.result())
                || response.rates() == null
                || response.base_code() == null) {
            throw new IllegalArgumentException("Invalid exchange-rate response");
        }
        return new ExchangeRates(
                response.base_code(),
                Map.copyOf(response.rates()),
                Instant.ofEpochSecond(response.time_last_update_unix()).atZone(ZoneOffset.UTC).toLocalDate(),
                Instant.ofEpochSecond(response.time_next_update_unix()));
    }
}
