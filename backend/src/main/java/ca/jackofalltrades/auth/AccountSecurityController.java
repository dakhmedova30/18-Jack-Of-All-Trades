package ca.jackofalltrades.auth;

import ca.jackofalltrades.common.security.CurrentBusiness;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The Security settings tab: change password, devices logged in, recent logins. */
@RestController
@RequestMapping("/api/auth")
public class AccountSecurityController {

    private final AccountSecurityService security;
    private final CurrentBusiness currentBusiness;

    public AccountSecurityController(AccountSecurityService security, CurrentBusiness currentBusiness) {
        this.security = security;
        this.currentBusiness = currentBusiness;
    }

    /** Changes the password, then logs out every other device (this one stays logged in). */
    @PutMapping("/me/password")
    public ResponseEntity<Void> changePassword(
            @Valid @RequestBody ChangePasswordRequest body, HttpServletRequest request) {
        int id = currentBusiness.id();
        security.changePassword(id, body);
        security.logOutOtherSessions(id, currentSessionId(request));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/sessions")
    public List<SessionResponse> sessions(HttpServletRequest request) {
        return security.listSessions(currentBusiness.id(), currentSessionId(request));
    }

    @PostMapping("/sessions/logout-others")
    public ResponseEntity<Void> logOutOthers(HttpServletRequest request) {
        security.logOutOtherSessions(currentBusiness.id(), currentSessionId(request));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/login-activity")
    public List<LoginEventResponse> loginActivity(@RequestParam(defaultValue = "10") int limit) {
        return security.recentLogins(currentBusiness.id(), Math.max(1, Math.min(limit, 50)));
    }

    private static String currentSessionId(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        return session == null ? null : session.getId();
    }
}
