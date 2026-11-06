package ca.jackofalltrades;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration;
import ca.jackofalltrades.currency.ExchangeRateProperties;
import java.time.Clock;
import org.springframework.context.annotation.Bean;

// Logins go through our own /api/auth endpoints, so Spring Boot's default
// in-memory user (and its generated password in the logs) is not wanted.
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@EnableConfigurationProperties(ExchangeRateProperties.class)
public class JackOfAllTradesApplication {

	@Bean
	Clock systemClock() {
		return Clock.systemUTC();
	}

	public static void main(String[] args) {
		SpringApplication.run(JackOfAllTradesApplication.class, args);
	}

}
