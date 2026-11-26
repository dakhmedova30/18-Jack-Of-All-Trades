package ca.jackofalltrades.sales;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
class MiscLookup {

    private final JdbcClient jdbc;

    MiscLookup(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    boolean exists(Integer businessId, Integer miscId) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM miscellaneous_records WHERE id = :id AND business_id = :b)")
                .param("id", miscId)
                .param("b", businessId)
                .query(Boolean.class)
                .single();
    }
}
