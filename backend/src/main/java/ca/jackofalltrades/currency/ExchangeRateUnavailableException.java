package ca.jackofalltrades.currency;

public class ExchangeRateUnavailableException extends RuntimeException {

    public ExchangeRateUnavailableException() {
        super("Exchange rates are currently unavailable. Please try again shortly.");
    }
}
