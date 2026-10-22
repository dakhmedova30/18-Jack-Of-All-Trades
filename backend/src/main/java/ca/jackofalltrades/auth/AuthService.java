package ca.jackofalltrades.auth;

import ca.jackofalltrades.common.api.BadRequestException;
import ca.jackofalltrades.common.api.UnauthorizedException;
import java.util.Optional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final BusinessRepository businesses;
    private final PasswordEncoder passwordEncoder;

    public AuthService(BusinessRepository businesses, PasswordEncoder passwordEncoder) {
        this.businesses = businesses;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public Business register(RegisterRequest request) {
        if (businesses.existsByEmail(request.email())) {
            throw new BadRequestException("An account with that email already exists");
        }
        String hash = passwordEncoder.encode(request.password());
        return businesses.save(new Business(request.name(), request.email(), hash));
    }

    @Transactional(readOnly = true)
    public Business authenticate(LoginRequest request) {
        return businesses.findByEmail(request.email())
                .filter(business -> passwordEncoder.matches(request.password(), business.getPasswordHash()))
                .orElseThrow(() -> new UnauthorizedException("Incorrect email or password"));
    }

    @Transactional(readOnly = true)
    public Optional<Business> find(Integer id) {
        return businesses.findById(id);
    }
}
