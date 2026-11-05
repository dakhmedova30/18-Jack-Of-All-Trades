package ca.jackofalltrades;

import org.springframework.boot.SpringApplication;

public class TestBackendApplication {

	public static void main(String[] args) {
		SpringApplication.from(JackOfAllTradesApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
