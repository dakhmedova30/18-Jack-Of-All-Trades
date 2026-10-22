package ca.jackofalltrades.auth;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BusinessRepository extends JpaRepository<Business, Integer> {

    Optional<Business> findByEmail(String email);

    boolean existsByEmail(String email);
}
