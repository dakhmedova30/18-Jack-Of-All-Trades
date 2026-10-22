package ca.jackofalltrades.auth;

import java.time.Instant;

/** The {@code Business} JSON in contract §2. */
public record BusinessResponse(Integer id, String name, String email, Instant createdAt) {

    static BusinessResponse from(Business business) {
        return new BusinessResponse(business.getId(), business.getName(), business.getEmail(), business.getCreatedAt());
    }
}
