package ca.jackofalltrades.expensetags;

import java.util.List;
import java.util.Optional;
import org.springframework.data.repository.Repository;

/** Business-scoped only, like ItemRepository. */
public interface ExpenseTagRepository extends Repository<ExpenseTag, Integer> {

    ExpenseTag save(ExpenseTag tag);

    void delete(ExpenseTag tag);

    Optional<ExpenseTag> findByIdAndBusinessId(Integer id, Integer businessId);

    List<ExpenseTag> findByBusinessIdOrderByIdAsc(Integer businessId);

    /** Ignoring case, matching the unique index on (business_id, lower(name)). */
    boolean existsByBusinessIdAndNameIgnoreCase(Integer businessId, String name);
}
