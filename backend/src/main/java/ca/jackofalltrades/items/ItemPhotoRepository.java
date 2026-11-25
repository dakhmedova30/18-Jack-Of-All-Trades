package ca.jackofalltrades.items;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Item photo bytes, kept apart from the items table. Like ItemRepository, every method takes a
 * businessId and joins items on it, so one business can never read or change another's photos.
 */
@Repository
public class ItemPhotoRepository {

    /** A stored photo: its media type and bytes. */
    public record Photo(String contentType, byte[] data) {}

    private final JdbcClient jdbcClient;

    public ItemPhotoRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    /** Sets or replaces the photo. Returns when it was saved, or empty if the business has no such item. */
    Optional<Instant> save(int itemId, int businessId, String contentType, byte[] data) {
        return jdbcClient.sql("""
                        INSERT INTO item_photos (item_id, content_type, data, updated_at)
                        SELECT id, :contentType, :data, now() FROM items
                        WHERE id = :itemId AND business_id = :businessId
                        ON CONFLICT (item_id) DO UPDATE
                        SET content_type = EXCLUDED.content_type, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
                        RETURNING updated_at
                        """)
                .param("itemId", itemId)
                .param("businessId", businessId)
                .param("contentType", contentType)
                .param("data", data)
                .query((rs, rowNum) -> rs.getObject("updated_at", OffsetDateTime.class).toInstant())
                .optional();
    }

    void delete(int itemId, int businessId) {
        jdbcClient.sql("""
                        DELETE FROM item_photos p USING items i
                        WHERE p.item_id = i.id AND i.id = :itemId AND i.business_id = :businessId
                        """)
                .param("itemId", itemId)
                .param("businessId", businessId)
                .update();
    }

    Optional<Photo> find(int itemId, int businessId) {
        return findWhere(itemId, businessId, "");
    }

    /** The photo of an item shown on the business's public profile; empty if the item isn't public. */
    public Optional<Photo> findPublic(int itemId, int businessId) {
        return findWhere(itemId, businessId, "AND i.is_public");
    }

    /** {@code extraCondition} is one of the constants above, never user input. */
    private Optional<Photo> findWhere(int itemId, int businessId, String extraCondition) {
        return jdbcClient.sql("""
                        SELECT p.content_type, p.data FROM item_photos p
                        JOIN items i ON i.id = p.item_id
                        WHERE i.id = :itemId AND i.business_id = :businessId %s
                        """.formatted(extraCondition))
                .param("itemId", itemId)
                .param("businessId", businessId)
                .query((rs, rowNum) -> new Photo(rs.getString("content_type"), rs.getBytes("data")))
                .optional();
    }
}
