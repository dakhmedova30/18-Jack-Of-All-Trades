package ca.jackofalltrades.currency;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;

public record ExchangeRates(
        String baseCurrency, Map<String, BigDecimal> rates, Instant asOf, Instant refreshAt) {

    static ExchangeRates from(ExchangeRateResponse response) {
        if (response == null
                || !"success".equals(response.result())
                || response.rates() == null
                || response.base_code() == null
                || response.time_last_update_unix() <= 0
                || response.time_next_update_unix() <= 0) {
            throw new IllegalArgumentException("Invalid exchange-rate response");
        }
        Instant asOf = response.time_last_update_utc() == null || response.time_last_update_utc().isBlank()
                ? Instant.ofEpochSecond(response.time_last_update_unix())
                : ZonedDateTime.parse(response.time_last_update_utc(), DateTimeFormatter.RFC_1123_DATE_TIME).toInstant();
        return new ExchangeRates(
                response.base_code(),
                Map.copyOf(response.rates()),
                asOf,
                Instant.ofEpochSecond(response.time_next_update_unix()));
    }
}
