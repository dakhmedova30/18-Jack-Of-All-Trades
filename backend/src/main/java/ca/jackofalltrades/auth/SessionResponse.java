package ca.jackofalltrades.auth;

import java.time.Instant;

/** One logged-in browser or device. No session id: the page never needs to name a session. */
public record SessionResponse(String userAgent, Instant createdAt, Instant lastActiveAt, boolean current) {}
