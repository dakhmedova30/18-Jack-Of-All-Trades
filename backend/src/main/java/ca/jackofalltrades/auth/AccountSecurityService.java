package ca.jackofalltrades.auth;

import ca.jackofalltrades.common.api.BadRequestException;
import ca.jackofalltrades.common.api.UnauthorizedException;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Change password, the other devices logged in, and recent login activity. */
@Service
public class AccountSecurityService {

    /** The session attribute that remembers which browser logged in. */
    static final String USER_AGENT_ATTRIBUTE = "userAgent";

    private static final int MAX_USER_AGENT = 300;
    private static final int KEEP_LOGIN_EVENTS = 50;

    private final BusinessRepository businesses;
    private final PasswordEncoder passwordEncoder;
    private final FindByIndexNameSessionRepository<? extends Session> sessions;
    private final JdbcClient jdbcClient;

    public AccountSecurityService(
            BusinessRepository businesses,
            PasswordEncoder passwordEncoder,
            FindByIndexNameSessionRepository<? extends Session> sessions,
            JdbcClient jdbcClient) {
        this.businesses = businesses;
        this.passwordEncoder = passwordEncoder;
        this.sessions = sessions;
        this.jdbcClient = jdbcClient;
    }

    static String clip(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return null;
        }
        return userAgent.length() > MAX_USER_AGENT ? userAgent.substring(0, MAX_USER_AGENT) : userAgent;
    }

    @Transactional
    public void changePassword(Integer businessId, ChangePasswordRequest request) {
        Business business = businesses.findById(businessId)
                .orElseThrow(() -> new UnauthorizedException("Not logged in"));
        // 400, not 401: a 401 would look like an expired session and bounce the user to /login.
        if (!passwordEncoder.matches(request.currentPassword(), business.getPasswordHash())) {
            throw new BadRequestException("Incorrect password");
        }
        if (request.currentPassword().equals(request.newPassword())) {
            throw new BadRequestException("New password must be different from the current one");
        }
        business.setPasswordHash(passwordEncoder.encode(request.newPassword()));
    }

    /**
     * Permanently deletes the business and everything it owns (items, sales, expenses, channels,
     * tags, pictures, login history: the database cascades), and logs out its other devices.
     * The caller ends the current session.
     */
    @Transactional
    public void deleteAccount(Integer businessId, DeleteAccountRequest request, String currentSessionId) {
        Business business = businesses.findById(businessId)
                .orElseThrow(() -> new UnauthorizedException("Not logged in"));
        // 400, not 401: a 401 would look like an expired session and bounce the user to /login.
        if (!passwordEncoder.matches(request.currentPassword(), business.getPasswordHash())) {
            throw new BadRequestException("Incorrect password");
        }
        businesses.delete(business);
        businesses.flush();
        logOutOtherSessions(businessId, currentSessionId);
    }

    /** Every unexpired session of this business, most recently active first. */
    public List<SessionResponse> listSessions(Integer businessId, String currentSessionId) {
        return sessions.findByPrincipalName(String.valueOf(businessId)).entrySet().stream()
                .map(entry -> {
                    Session session = entry.getValue();
                    return new SessionResponse(
                            session.<String>getAttribute(USER_AGENT_ATTRIBUTE),
                            session.getCreationTime(),
                            session.getLastAccessedTime(),
                            entry.getKey().equals(currentSessionId));
                })
                .sorted(Comparator.comparing(SessionResponse::lastActiveAt).reversed())
                .toList();
    }

    /** Logs out every session of this business except the current one. */
    public void logOutOtherSessions(Integer businessId, String currentSessionId) {
        Map<String, ? extends Session> all = sessions.findByPrincipalName(String.valueOf(businessId));
        all.keySet().stream()
                .filter(id -> !id.equals(currentSessionId))
                .forEach(sessions::deleteById);
    }

    @Transactional
    public void recordLogin(Integer businessId, String userAgent) {
        jdbcClient.sql("INSERT INTO login_events (business_id, user_agent) VALUES (:businessId, :userAgent)")
                .param("businessId", businessId)
                .param("userAgent", clip(userAgent))
                .update();
        jdbcClient.sql("""
                        DELETE FROM login_events
                        WHERE business_id = :businessId
                          AND id NOT IN (SELECT id FROM login_events WHERE business_id = :businessId
                                         ORDER BY logged_in_at DESC, id DESC LIMIT :keep)
                        """)
                .param("businessId", businessId)
                .param("keep", KEEP_LOGIN_EVENTS)
                .update();
    }

    @Transactional(readOnly = true)
    public List<LoginEventResponse> recentLogins(Integer businessId, int limit) {
        return jdbcClient.sql("""
                        SELECT logged_in_at, user_agent FROM login_events
                        WHERE business_id = :businessId
                        ORDER BY logged_in_at DESC, id DESC LIMIT :limit
                        """)
                .param("businessId", businessId)
                .param("limit", limit)
                .query((rs, rowNum) -> new LoginEventResponse(
                        rs.getObject("logged_in_at", OffsetDateTime.class).toInstant(),
                        rs.getString("user_agent")))
                .list();
    }
}
