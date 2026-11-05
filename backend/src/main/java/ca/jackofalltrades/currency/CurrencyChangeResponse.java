package ca.jackofalltrades.currency;

import ca.jackofalltrades.auth.BusinessResponse;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record CurrencyChangeResponse(
        BusinessResponse business,
        BigDecimal rate,
        LocalDate rateDate,
        ExchangeRateService.RateSource source,
        Instant asOf) {}
