package ca.jackofalltrades.currency;

import ca.jackofalltrades.auth.Business;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record CurrencyChangeResult(
        Business business,
        BigDecimal rate,
        LocalDate rateDate,
        ExchangeRateService.RateSource source,
        Instant asOf,
        String notice) {}
