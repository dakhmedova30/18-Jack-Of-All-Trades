package ca.jackofalltrades.currency;

import java.math.BigDecimal;
import java.util.Map;

/** The subset of the ExchangeRate-API response used by this application. */
public record ExchangeRateResponse(
        String result,
        long time_last_update_unix,
        String time_last_update_utc,
        long time_next_update_unix,
        String time_next_update_utc,
        String base_code,
        Map<String, BigDecimal> rates) {

    public ExchangeRateResponse(
            String result,
            long timeLastUpdateUnix,
            long timeNextUpdateUnix,
            String baseCode,
            Map<String, BigDecimal> rates) {
        this(result, timeLastUpdateUnix, null, timeNextUpdateUnix, null, baseCode, rates);
    }
}
