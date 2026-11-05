package ca.jackofalltrades.currency;

import ca.jackofalltrades.auth.Business;
import java.math.BigDecimal;
import java.time.LocalDate;

public record CurrencyChangeResult(Business business, BigDecimal rate, LocalDate rateDate) {}
