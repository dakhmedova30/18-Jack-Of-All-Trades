package ca.jackofalltrades.currency;

import jakarta.annotation.PostConstruct;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "exchange")
public class ExchangeRateProperties {

    @Valid
    private final Rate rate = new Rate();

    @Valid
    private final Rates rates = new Rates();

    private List<String> supportedCurrencies = new ArrayList<>();

    public Rate getRate() {
        return rate;
    }

    public Rates getRates() {
        return rates;
    }

    public List<String> getSupportedCurrencies() {
        return supportedCurrencies;
    }

    public void setSupportedCurrencies(List<String> supportedCurrencies) {
        this.supportedCurrencies = supportedCurrencies;
    }

    @PostConstruct
    public void validateConfiguration() {
        String baseUrl = rate.getApi().getBaseUrl();
        if (baseUrl == null || baseUrl.isBlank()) {
            throw invalidBaseUrl(baseUrl);
        }
        try {
            URI uri = URI.create(baseUrl.strip());
            String scheme = uri.getScheme();
            if (scheme == null
                    || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))
                    || uri.getHost() == null) {
                throw invalidBaseUrl(baseUrl);
            }
        } catch (IllegalArgumentException error) {
            throw invalidBaseUrl(baseUrl);
        }
    }

    private static IllegalStateException invalidBaseUrl(String value) {
        String display = value == null || value.isBlank() ? "<blank>" : value;
        return new IllegalStateException(
                "exchange.rate.api.base-url must be a full HTTP(S) URL; invalid value: '" + display + "'");
    }

    public static class Rate {

        @Valid
        private final Api api = new Api();

        public Api getApi() {
            return api;
        }
    }

    public static class Api {

        @NotBlank(message = "exchange.rate.api.base-url must not be blank")
        private String baseUrl;

        public String getBaseUrl() {
            return baseUrl;
        }

        public void setBaseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
        }
    }

    public static class Rates {

        private String source = "live";
        private String snapshotLocation = "classpath:exchange-rates-fallback.json";

        public String getSource() {
            return source;
        }

        public void setSource(String source) {
            this.source = source == null ? null : source.strip().toLowerCase(Locale.ROOT);
        }

        public String getSnapshotLocation() {
            return snapshotLocation;
        }

        public void setSnapshotLocation(String snapshotLocation) {
            this.snapshotLocation = snapshotLocation;
        }
    }
}
