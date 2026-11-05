package ca.jackofalltrades.publicprofile;

import ca.jackofalltrades.publicprofile.PublicProfileResponse.PublicItem;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** The public items of one business, in plain SQL like ItemQueries. */
@Component
public class PublicProfileQueries {

    private final JdbcClient jdbcClient;

    public PublicProfileQueries(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    /** Only items marked public, A to Z. Selects just the columns the public may see. */
    public List<PublicItem> publicItems(int businessId) {
        return jdbcClient.sql("""
                        SELECT id, name, unit_price_cents, quantity > 0 AS in_stock
                        FROM items
                        WHERE business_id = :businessId AND is_public
                        ORDER BY name, id
                        """)
                .param("businessId", businessId)
                .query((rs, rowNum) -> new PublicItem(
                        rs.getInt("id"),
                        rs.getString("name"),
                        rs.getInt("unit_price_cents"),
                        rs.getBoolean("in_stock")))
                .list();
    }
}
