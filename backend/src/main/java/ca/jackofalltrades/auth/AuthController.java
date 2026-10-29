package ca.jackofalltrades.auth;

import ca.jackofalltrades.common.api.NotFoundException;
import ca.jackofalltrades.common.api.UnauthorizedException;
import ca.jackofalltrades.common.security.BusinessPrincipal;
import ca.jackofalltrades.common.security.CurrentBusiness;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import java.time.Duration;
import java.util.List;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Register, login, logout and "who am I" (contract §2). */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final CurrentBusiness currentBusiness;
    private final SecurityContextRepository securityContextRepository;
    private final AccountSecurityService accountSecurity;

    public AuthController(
            AuthService authService,
            CurrentBusiness currentBusiness,
            SecurityContextRepository securityContextRepository,
            AccountSecurityService accountSecurity) {
        this.accountSecurity = accountSecurity;
        this.authService = authService;
        this.currentBusiness = currentBusiness;
        this.securityContextRepository = securityContextRepository;
    }

    @PostMapping("/register")
    public ResponseEntity<BusinessResponse> register(
            @Valid @RequestBody RegisterRequest body, HttpServletRequest request, HttpServletResponse response) {
        Business business = authService.register(body);
        logIn(business, request, response);
        return ResponseEntity.status(HttpStatus.CREATED).body(BusinessResponse.from(business));
    }

    @PostMapping("/login")
    public BusinessResponse login(
            @Valid @RequestBody LoginRequest body, HttpServletRequest request, HttpServletResponse response) {
        Business business = authService.authenticate(body);
        logIn(business, request, response);
        return BusinessResponse.from(business);
    }

    /** Deletes the account and all its data for good; needs the current password. */
    @DeleteMapping("/me")
    public ResponseEntity<Void> deleteAccount(
            @Valid @RequestBody DeleteAccountRequest body, HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        accountSecurity.deleteAccount(currentBusiness.id(), body, session == null ? null : session.getId());
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate(); // Spring Session also expires the jack_session cookie
        }
        SecurityContextHolder.clearContext();
        return ResponseEntity.noContent().build();
    }

    /** Under the permitted /api/auth/**, so it checks login itself. */
    @GetMapping("/me")
    public BusinessResponse me() {
        return currentBusiness.find()
                .flatMap(authService::find)
                .map(BusinessResponse::from)
                .orElseThrow(() -> new UnauthorizedException("Not logged in"));
    }

    /** Changes the business name and details (type, country, time zone, currency). */
    @PatchMapping("/me")
    public BusinessResponse updateMe(@Valid @RequestBody UpdateBusinessRequest body) {
        return BusinessResponse.from(authService.update(currentBusiness.id(), body));
    }

    /** Sets the profile picture. The body is the raw image (JPEG, PNG or WebP), up to 512 KB. */
    @PutMapping("/me/avatar")
    public BusinessResponse setAvatar(
            @RequestBody byte[] data, @RequestHeader(value = "Content-Type", required = false) String contentType) {
        return BusinessResponse.from(authService.setAvatar(currentBusiness.id(), contentType, data));
    }

    @DeleteMapping("/me/avatar")
    public BusinessResponse removeAvatar() {
        return BusinessResponse.from(authService.removeAvatar(currentBusiness.id()));
    }

    /** The picture itself, for an {@code <img>}. The session cookie goes along with it. */
    @GetMapping("/me/avatar")
    public ResponseEntity<byte[]> avatar() {
        int id = currentBusiness.id();
        return image(authService.findAvatar(id), "Profile picture", id);
    }

    /** Sets the business logo, with the same rules as the profile picture. */
    @PutMapping("/me/logo")
    public BusinessResponse setLogo(
            @RequestBody byte[] data, @RequestHeader(value = "Content-Type", required = false) String contentType) {
        return BusinessResponse.from(authService.setLogo(currentBusiness.id(), contentType, data));
    }

    @DeleteMapping("/me/logo")
    public BusinessResponse removeLogo() {
        return BusinessResponse.from(authService.removeLogo(currentBusiness.id()));
    }

    @GetMapping("/me/logo")
    public ResponseEntity<byte[]> logo() {
        int id = currentBusiness.id();
        return image(authService.findLogo(id), "Logo", id);
    }

    private static ResponseEntity<byte[]> image(
            java.util.Optional<AvatarRepository.Avatar> image, String what, int id) {
        return image
                .map(found -> ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(found.contentType()))
                        .cacheControl(CacheControl.maxAge(Duration.ofDays(1)).cachePrivate())
                        .body(found.data()))
                .orElseThrow(() -> new NotFoundException(what, id));
    }

    /** Changes the login email; needs the current password. */
    @PutMapping("/me/email")
    public BusinessResponse changeEmail(@Valid @RequestBody ChangeEmailRequest body) {
        return BusinessResponse.from(authService.changeEmail(currentBusiness.id(), body));
    }

    /**
     * Stores the login in the session. Spring Security doesn't save a manually created login on
     * its own, so without saveContext the next request would be anonymous.
     */
    private void logIn(Business business, HttpServletRequest request, HttpServletResponse response) {
        if (request.getSession(false) != null) {
            request.changeSessionId(); // protects against session fixation
        }
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
                new BusinessPrincipal(business.getId()), null, List.of()));
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, request, response);

        // Remember which browser this is, for the Security tab's device list and login history.
        String userAgent = AccountSecurityService.clip(request.getHeader("User-Agent"));
        if (userAgent != null) {
            request.getSession().setAttribute(AccountSecurityService.USER_AGENT_ATTRIBUTE, userAgent);
        }
        accountSecurity.recordLogin(business.getId(), userAgent);
    }
}
