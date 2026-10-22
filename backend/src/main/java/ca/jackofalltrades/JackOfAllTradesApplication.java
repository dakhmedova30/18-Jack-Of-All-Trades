package ca.jackofalltrades;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration;

// Logins go through our own /api/auth endpoints, so Spring Boot's default
// in-memory user (and its generated password in the logs) is not wanted.
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
public class JackOfAllTradesApplication {

	public static void main(String[] args) {
		SpringApplication.run(JackOfAllTradesApplication.class, args);
	}

}
