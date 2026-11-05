package ca.jackofalltrades.common.security;

import ca.jackofalltrades.common.api.UnauthorizedException;
import java.util.Optional;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/** The logged-in business. Services take the business id only from here, never from the request. */
@Component
public class CurrentBusiness {

    /** The logged-in business's id; 401 "Log in to continue" if nobody is logged in. */
    public Integer id() {
        return find().orElseThrow(() -> new UnauthorizedException("Log in to continue"));
    }

    public Optional<Integer> find() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof BusinessPrincipal principal) {
            return Optional.of(principal.businessId());
        }
        return Optional.empty();
    }
}
