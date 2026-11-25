package ca.jackofalltrades.sales;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** Lets sales check that a market belongs to the business without depending on the markets package. */
@Component
class MarketLookup {

    private final JdbcClient jdbc;

    MarketLookup(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    boolean exists(Integer businessId, Integer marketId) {
        return jdbc.sql("SELECT count(*) FROM markets WHERE id = :id AND business_id = :b")
                .param("id", marketId)
                .param("b", businessId)
                .query(Integer.class)
                .single() > 0;
    }
}
