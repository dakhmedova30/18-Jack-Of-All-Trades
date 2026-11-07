package ca.jackofalltrades.currency;

/** Boundary for fetching exchange-rate responses; replaceable in unit tests. */
public interface ExchangeRateHttpClient {

    ExchangeRateResponse fetch(String baseUrl, String baseCurrency);
}
