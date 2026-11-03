package ca.jackofalltrades.auth;

import ca.jackofalltrades.channels.ChannelService;
import ca.jackofalltrades.common.api.BadRequestException;
import ca.jackofalltrades.expensetags.ExpenseTagService;
import ca.jackofalltrades.common.api.UnauthorizedException;
import java.net.URI;
import java.net.URISyntaxException;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private static final Set<String> CURRENCIES = Set.of("CAD", "USD", "EUR", "GBP", "AUD");

    /** Pictures and logos are resized in the browser, so a real one is far smaller than this. */
    static final int MAX_IMAGE_BYTES = 512 * 1024;
    private static final Set<String> IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
    private static final Pattern PHONE = Pattern.compile("[0-9+()\\-.\\s]{3,30}");

    private final BusinessRepository businesses;
    private final AvatarRepository avatars;
    private final PasswordEncoder passwordEncoder;
    private final ChannelService channelService;
    private final ExpenseTagService expenseTagService;

    public AuthService(BusinessRepository businesses, AvatarRepository avatars, PasswordEncoder passwordEncoder,
            ChannelService channelService, ExpenseTagService expenseTagService) {
        this.businesses = businesses;
        this.avatars = avatars;
        this.passwordEncoder = passwordEncoder;
        this.channelService = channelService;
        this.expenseTagService = expenseTagService;
    }

    @Transactional
    public Business register(RegisterRequest request) {
        if (businesses.existsByEmail(request.email())) {
            throw new BadRequestException("An account with that email already exists");
        }
        String hash = passwordEncoder.encode(request.password());
        Business newBusiness = new Business(request.name(), request.email(), hash);
        newBusiness.setLastLoginAt(Instant.now()); // registering logs you in
        Business business = businesses.save(newBusiness);
        channelService.createStarterChannels(business.getId());
        expenseTagService.createStarterTags(business.getId());
        return business;
    }

    @Transactional
    public Business authenticate(LoginRequest request) {
        Business business = businesses.findByEmail(request.email())
                .filter(found -> passwordEncoder.matches(request.password(), found.getPasswordHash()))
                .orElseThrow(() -> new UnauthorizedException("Incorrect email or password"));
        business.setLastLoginAt(Instant.now());
        return business;
    }

    @Transactional
    public Business update(Integer id, UpdateBusinessRequest request) {
        Business business = businesses.findById(id)
                .orElseThrow(() -> new UnauthorizedException("Not logged in"));
        if (request.name() != null) {
            if (request.name().isEmpty()) {
                throw new BadRequestException("Business name is required");
            }
            business.setName(request.name());
        }
        if (request.businessType() != null) {
            business.setBusinessType(request.businessType().isEmpty() ? null : request.businessType());
        }
        if (request.country() != null) {
            business.setCountry(request.country().isEmpty() ? null : request.country());
        }
        if (request.timeZone() != null) {
            if (!ZoneId.getAvailableZoneIds().contains(request.timeZone())) {
                throw new BadRequestException("Choose a valid time zone");
            }
            business.setTimeZone(request.timeZone());
        }
        if (request.lowStockThreshold() != null) {
            business.setLowStockThreshold(request.lowStockThreshold());
        }
        if (request.currency() != null) {
            if (!CURRENCIES.contains(request.currency())) {
                throw new BadRequestException("Choose a supported currency");
            }
            business.setCurrency(request.currency());
        }
        if (request.ownerFirstName() != null) {
            business.setOwnerFirstName(emptyToNull(request.ownerFirstName()));
        }
        if (request.ownerLastName() != null) {
            business.setOwnerLastName(emptyToNull(request.ownerLastName()));
        }
        if (request.phone() != null) {
            business.setPhone(emptyToNull(phone(request.phone())));
        }
        if (request.addressLine() != null) {
            business.setAddressLine(emptyToNull(request.addressLine()));
        }
        if (request.city() != null) {
            business.setCity(emptyToNull(request.city()));
        }
        if (request.region() != null) {
            business.setRegion(emptyToNull(request.region()));
        }
        if (request.postalCode() != null) {
            business.setPostalCode(emptyToNull(request.postalCode()));
        }
        if (request.description() != null) {
            business.setDescription(emptyToNull(request.description()));
        }
        if (request.website() != null) {
            business.setWebsite(emptyToNull(webAddress(request.website(), "Website")));
        }
        if (request.instagram() != null) {
            business.setInstagram(emptyToNull(webAddress(request.instagram(), "Instagram link")));
        }
        if (request.facebook() != null) {
            business.setFacebook(emptyToNull(webAddress(request.facebook(), "Facebook link")));
        }
        if (request.tiktok() != null) {
            business.setTiktok(emptyToNull(webAddress(request.tiktok(), "TikTok link")));
        }
        if (request.etsy() != null) {
            business.setEtsy(emptyToNull(webAddress(request.etsy(), "Etsy link")));
        }
        return business;
    }

    @Transactional
    public Business setAvatar(Integer id, String contentType, byte[] data) {
        return setImage(id, AvatarRepository.Kind.AVATAR, contentType, data);
    }

    @Transactional
    public Business removeAvatar(Integer id) {
        return removeImage(id, AvatarRepository.Kind.AVATAR);
    }

    @Transactional(readOnly = true)
    public Optional<AvatarRepository.Avatar> findAvatar(Integer id) {
        return avatars.find(AvatarRepository.Kind.AVATAR, id);
    }

    @Transactional
    public Business setLogo(Integer id, String contentType, byte[] data) {
        return setImage(id, AvatarRepository.Kind.LOGO, contentType, data);
    }

    @Transactional
    public Business removeLogo(Integer id) {
        return removeImage(id, AvatarRepository.Kind.LOGO);
    }

    @Transactional(readOnly = true)
    public Optional<AvatarRepository.Avatar> findLogo(Integer id) {
        return avatars.find(AvatarRepository.Kind.LOGO, id);
    }

    private Business setImage(Integer id, AvatarRepository.Kind kind, String contentType, byte[] data) {
        String type = contentType == null ? "" : contentType.split(";")[0].strip().toLowerCase();
        if (!IMAGE_TYPES.contains(type)) {
            throw new BadRequestException("Image must be a JPEG, PNG or WebP file");
        }
        if (data.length == 0) {
            throw new BadRequestException("Image is empty");
        }
        if (data.length > MAX_IMAGE_BYTES) {
            throw new BadRequestException("Image must be 512 KB or smaller");
        }
        Business business = businesses.findById(id)
                .orElseThrow(() -> new UnauthorizedException("Not logged in"));
        avatars.save(kind, id, type, data);
        stamp(business, kind, Instant.now());
        return business;
    }

    private Business removeImage(Integer id, AvatarRepository.Kind kind) {
        Business business = businesses.findById(id)
                .orElseThrow(() -> new UnauthorizedException("Not logged in"));
        avatars.delete(kind, id);
        stamp(business, kind, null);
        return business;
    }

    private static void stamp(Business business, AvatarRepository.Kind kind, Instant at) {
        switch (kind) {
            case AVATAR -> business.setAvatarUpdatedAt(at);
            case LOGO -> business.setLogoUpdatedAt(at);
        }
    }

    private static String emptyToNull(String value) {
        return value.isEmpty() ? null : value;
    }

    /** A phone number: digits with the usual separators. Empty clears it. */
    private static String phone(String value) {
        if (!value.isEmpty() && !PHONE.matcher(value).matches()) {
            throw new BadRequestException("Enter a valid phone number");
        }
        return value;
    }

    /** A web address; "etsy.com/shop/me" becomes "https://etsy.com/shop/me". Empty clears it. */
    private static String webAddress(String value, String label) {
        if (value.isEmpty()) {
            return value;
        }
        String withScheme = value.contains("://") ? value : "https://" + value;
        try {
            URI uri = new URI(withScheme);
            boolean web = "http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme());
            if (web && uri.getHost() != null && uri.getHost().contains(".")) {
                return withScheme;
            }
        } catch (URISyntaxException ignored) {
            // falls through to the error below
        }
        throw new BadRequestException("Enter a valid web address for " + label.toLowerCase());
    }

    @Transactional
    public Business changeEmail(Integer id, ChangeEmailRequest request) {
        Business business = businesses.findById(id)
                .orElseThrow(() -> new UnauthorizedException("Not logged in"));
        // 400, not 401: a 401 would look like an expired session and bounce the user to /login.
        if (!passwordEncoder.matches(request.currentPassword(), business.getPasswordHash())) {
            throw new BadRequestException("Incorrect password");
        }
        if (!request.email().equals(business.getEmail())) {
            if (businesses.existsByEmail(request.email())) {
                throw new BadRequestException("An account with that email already exists");
            }
            business.setEmail(request.email());
        }
        return business;
    }

    @Transactional(readOnly = true)
    public Optional<Business> find(Integer id) {
        return businesses.findById(id);
    }
}
