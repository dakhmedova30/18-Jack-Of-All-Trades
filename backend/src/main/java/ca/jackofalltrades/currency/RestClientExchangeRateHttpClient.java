package ca.jackofalltrades.currency;

import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class RestClientExchangeRateHttpClient implements ExchangeRateHttpClient {

    private final RestClient restClient = RestClient.create();

    @Override
    public ExchangeRateResponse fetch(String baseUrl, String baseCurrency) {
        return restClient.get()
                .uri("{baseUrl}/{baseCurrency}", baseUrl, baseCurrency)
                .retrieve()
                .body(ExchangeRateResponse.class);
    }
}
