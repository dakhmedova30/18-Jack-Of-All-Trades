package ca.jackofalltrades.publicprofile;

import ca.jackofalltrades.publicprofile.PublicProfileResponse.PublicItem;
import java.time.OffsetDateTime;
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

    /**
     * Only items marked public, A to Z. Selects just the columns the public may see. Photo URLs
     * go through the profile's slug, and change (?v=) whenever the photo does.
     */
    public List<PublicItem> publicItems(int businessId, String slug) {
        return jdbcClient.sql("""
                        SELECT i.id, i.name, i.unit_price_cents, i.quantity > 0 AS in_stock,
                               p.updated_at AS photo_updated_at
                        FROM items i
                        LEFT JOIN item_photos p ON p.item_id = i.id
                        WHERE i.business_id = :businessId AND i.is_public
                        ORDER BY i.name, i.id
                        """)
                .param("businessId", businessId)
                .query((rs, rowNum) -> {
                    int id = rs.getInt("id");
                    OffsetDateTime photoUpdatedAt = rs.getObject("photo_updated_at", OffsetDateTime.class);
                    String photoUrl = photoUpdatedAt == null ? null
                            : "/api/public/businesses/" + slug + "/items/" + id + "/photo?v="
                                    + photoUpdatedAt.toInstant().toEpochMilli();
                    return new PublicItem(
                            id,
                            rs.getString("name"),
                            rs.getInt("unit_price_cents"),
                            rs.getBoolean("in_stock"),
                            photoUrl);
                })
                .list();
    }
}
