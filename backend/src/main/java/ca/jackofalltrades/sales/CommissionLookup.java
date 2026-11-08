package ca.jackofalltrades.sales;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
class CommissionLookup {

    private final JdbcClient jdbc;

    CommissionLookup(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    boolean exists(Integer businessId, Integer commissionId) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM commissions WHERE id = :id AND business_id = :b)")
                .param("id", commissionId)
                .param("b", businessId)
                .query(Boolean.class)
                .single();
    }
}
