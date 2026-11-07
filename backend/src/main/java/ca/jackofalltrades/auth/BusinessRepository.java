package ca.jackofalltrades.auth;

import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BusinessRepository extends JpaRepository<Business, Integer> {

    Optional<Business> findByEmail(String email);

    boolean existsByEmail(String email);

    Optional<Business> findByPublicSlug(String publicSlug);

    boolean existsByPublicSlugAndIdNot(String publicSlug, Integer id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from Business b where b.id = :id")
    Optional<Business> findLockedById(@Param("id") Integer id);
}
