package ca.jackofalltrades.items;

import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.repository.Repository;

/**
 * Extends Spring Data's bare {@link Repository} rather than JpaRepository on purpose:
 * JpaRepository would add unscoped findById/findAll. Every method here takes a businessId,
 * so one business can never read another's items. Copy this rule for every owned table.
 */
public interface ItemRepository extends Repository<Item, Integer> {

    /** Flushes so the returned item has its id and timestamps. */
    Item saveAndFlush(Item item);

    void delete(Item item);

    Optional<Item> findByIdAndBusinessId(Integer id, Integer businessId);

    /** Locks the row like the method below, so a PATCH or delete waits for a sale in progress. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Item> findLockedByIdAndBusinessId(Integer id, Integer businessId);

    /**
     * Locks the rows ({@code SELECT … FOR UPDATE}) until the transaction ends, in id order, so
     * concurrent stock changes wait for each other and can't deadlock. Used by sales and expenses.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    List<Item> findLockedByIdInAndBusinessIdOrderByIdAsc(Collection<Integer> ids, Integer businessId);
}
