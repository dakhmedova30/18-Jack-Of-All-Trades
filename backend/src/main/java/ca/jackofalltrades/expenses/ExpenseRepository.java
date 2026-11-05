package ca.jackofalltrades.expenses;

import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.repository.Repository;

/**
 * Business-scoped only, like ItemRepository. Writes lock the expense row first, then its items
 * (ItemRepository.findLockedBy…), always in that order, as SaleRepository does, so concurrent
 * writes can't deadlock and an expense's restock can't be undone twice.
 */
public interface ExpenseRepository extends Repository<Expense, Integer> {

    /** Flushes so the returned expense has its new lines' ids and the database's timestamps. */
    Expense saveAndFlush(Expense expense);

    void delete(Expense expense);

    Optional<Expense> findByIdAndBusinessId(Integer id, Integer businessId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Expense> findLockedByIdAndBusinessId(Integer id, Integer businessId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    List<Expense> findLockedByIdInAndBusinessIdOrderByIdAsc(Collection<Integer> ids, Integer businessId);
}
