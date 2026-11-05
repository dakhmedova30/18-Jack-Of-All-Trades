package ca.jackofalltrades.common.security;

import java.io.Serializable;
import org.springframework.security.core.AuthenticatedPrincipal;

/**
 * Who is logged in. Stored in the session (Spring Session serializes it into the
 * spring_session_attributes table), so it must be Serializable.
 */
public record BusinessPrincipal(Integer businessId) implements AuthenticatedPrincipal, Serializable {

    /** Recorded as the session's principal name. */
    @Override
    public String getName() {
        return String.valueOf(businessId);
    }
}
