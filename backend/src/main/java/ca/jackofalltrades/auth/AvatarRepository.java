package ca.jackofalltrades.auth;

import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** The profile picture and logo bytes, kept apart from the {@link Business} row. */
@Repository
public class AvatarRepository {

    /** Which image: each kind has its own table (same columns). The table name is never user input. */
    public enum Kind {
        AVATAR("business_avatars"),
        LOGO("business_logos");

        private final String table;

        Kind(String table) {
            this.table = table;
        }
    }

    /** A stored image: its media type and bytes. */
    public record Avatar(String contentType, byte[] data) {}

    private final JdbcClient jdbcClient;

    public AvatarRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    void save(Kind kind, int businessId, String contentType, byte[] data) {
        jdbcClient.sql("""
                        INSERT INTO %s (business_id, content_type, data)
                        VALUES (:businessId, :contentType, :data)
                        ON CONFLICT (business_id)
                        DO UPDATE SET content_type = EXCLUDED.content_type, data = EXCLUDED.data
                        """.formatted(kind.table))
                .param("businessId", businessId)
                .param("contentType", contentType)
                .param("data", data)
                .update();
    }

    void delete(Kind kind, int businessId) {
        jdbcClient.sql("DELETE FROM %s WHERE business_id = :businessId".formatted(kind.table))
                .param("businessId", businessId)
                .update();
    }

    Optional<Avatar> find(Kind kind, int businessId) {
        return jdbcClient.sql("SELECT content_type, data FROM %s WHERE business_id = :businessId".formatted(kind.table))
                .param("businessId", businessId)
                .query((rs, rowNum) -> new Avatar(rs.getString("content_type"), rs.getBytes("data")))
                .optional();
    }
}
