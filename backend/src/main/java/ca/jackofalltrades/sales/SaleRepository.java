package ca.jackofalltrades.sales;

import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.repository.Repository;

/**
 * Business-scoped only, like ItemRepository. Writes lock the sale row first, then its items
 * (ItemRepository.findLockedBy…), always in that order, so concurrent writes can't deadlock
 * and a sale can't be deleted (and its stock restored) twice.
 */
public interface SaleRepository extends Repository<Sale, Integer> {

    Sale save(Sale sale);

    void delete(Sale sale);

    Optional<Sale> findByIdAndBusinessId(Integer id, Integer businessId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Sale> findLockedByIdAndBusinessId(Integer id, Integer businessId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    List<Sale> findLockedByIdInAndBusinessIdOrderByIdAsc(Collection<Integer> ids, Integer businessId);
}
