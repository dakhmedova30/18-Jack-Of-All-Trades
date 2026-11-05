package ca.jackofalltrades.currency;

import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

@Component
public class RestClientExchangeRateHttpClient implements ExchangeRateHttpClient {

    private final RestClient restClient = RestClient.create();

    @Override
    public ExchangeRateResponse fetch(String baseUrl, String baseCurrency) {
        String normalizedBase = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
        var uri = UriComponentsBuilder.fromUriString(normalizedBase)
                .pathSegment(baseCurrency)
                .build()
                .toUri();
        return restClient.get()
                .uri(uri)
                .retrieve()
                .body(ExchangeRateResponse.class);
    }
}
