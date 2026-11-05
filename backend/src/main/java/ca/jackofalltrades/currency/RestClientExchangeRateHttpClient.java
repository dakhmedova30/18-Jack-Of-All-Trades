package ca.jackofalltrades.currency;

import java.time.Duration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

@Component
public class RestClientExchangeRateHttpClient implements ExchangeRateHttpClient {

    /**
     * Short timeouts: a slow or unreachable rate service should fall back to cached or bundled
     * rates quickly, not hold up every request waiting on it (ExchangeRateService fetches inside a
     * lock).
     */
    private final RestClient restClient = RestClient.builder().requestFactory(timeouts()).build();

    private static SimpleClientHttpRequestFactory timeouts() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(5));
        return factory;
    }

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
