package ca.jackofalltrades.auth;

import ca.jackofalltrades.common.api.UnauthorizedException;
import ca.jackofalltrades.common.security.BusinessPrincipal;
import ca.jackofalltrades.common.security.CurrentBusiness;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Register, login, logout and "who am I" (contract §2). */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final CurrentBusiness currentBusiness;
    private final SecurityContextRepository securityContextRepository;

    public AuthController(
            AuthService authService,
            CurrentBusiness currentBusiness,
            SecurityContextRepository securityContextRepository) {
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
    }
}
