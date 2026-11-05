package ca.jackofalltrades.auth;

import java.time.Instant;

/** One past login, from the "Recent login activity" list. */
public record LoginEventResponse(Instant at, String userAgent) {}
