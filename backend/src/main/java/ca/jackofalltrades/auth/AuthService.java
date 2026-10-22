package ca.jackofalltrades.auth;

import ca.jackofalltrades.channels.ChannelService;
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
    private final ChannelService channelService;

    public AuthService(BusinessRepository businesses, PasswordEncoder passwordEncoder,
            ChannelService channelService) {
        this.businesses = businesses;
        this.passwordEncoder = passwordEncoder;
        this.channelService = channelService;
    }

    @Transactional
    public Business register(RegisterRequest request) {
        if (businesses.existsByEmail(request.email())) {
            throw new BadRequestException("An account with that email already exists");
        }
        String hash = passwordEncoder.encode(request.password());
        Business business = businesses.save(new Business(request.name(), request.email(), hash));
        channelService.createStarterChannels(business.getId());
        return business;
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
