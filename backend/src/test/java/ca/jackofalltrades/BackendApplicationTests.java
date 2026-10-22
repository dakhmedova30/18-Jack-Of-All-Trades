package ca.jackofalltrades;

import org.junit.jupiter.api.Test;

/** Shares PostgresTestBase's context, so the test run starts only one Postgres container. */
class BackendApplicationTests extends PostgresTestBase {

	@Test
	void contextLoads() {
	}

}
