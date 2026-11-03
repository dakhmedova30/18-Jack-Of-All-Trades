package ca.jackofalltrades.channels;

import java.util.List;
import java.util.Optional;
import org.springframework.data.repository.Repository;

/** Business-scoped only, like ItemRepository. */
public interface ChannelRepository extends Repository<Channel, Integer> {

    Channel save(Channel channel);

    void delete(Channel channel);

    List<Channel> findByBusinessIdOrderByIdAsc(Integer businessId);

    Optional<Channel> findByIdAndBusinessId(Integer id, Integer businessId);

    /** Ignoring case, matching the unique index on (business_id, lower(name)). */
    boolean existsByBusinessIdAndNameIgnoreCase(Integer businessId, String name);
}
