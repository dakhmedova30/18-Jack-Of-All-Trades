package ca.jackofalltrades.currency;

import java.math.BigDecimal;
import java.util.Map;

/** The subset of the ExchangeRate-API response used by this application. */
public record ExchangeRateResponse(
        String result,
        long time_last_update_unix,
        long time_next_update_unix,
        String base_code,
        Map<String, BigDecimal> rates) {}
