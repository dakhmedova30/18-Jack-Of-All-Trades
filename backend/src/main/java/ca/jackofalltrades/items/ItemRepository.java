package ca.jackofalltrades.items;

import java.util.Optional;
import org.springframework.data.repository.Repository;

/**
 * Extends Spring Data's bare {@link Repository} rather than JpaRepository on purpose:
 * JpaRepository would add unscoped findById/findAll. Every method here takes a businessId,
 * so one business can never read another's items. Copy this rule for every owned table.
 */
public interface ItemRepository extends Repository<Item, Integer> {

    Optional<Item> findByIdAndBusinessId(Integer id, Integer businessId);
}
