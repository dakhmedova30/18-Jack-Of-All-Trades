package ca.jackofalltrades.auth;

import jakarta.validation.constraints.NotNull;

/** {@code DELETE /api/auth/me} body: the current password, as a last check before deleting. */
public record DeleteAccountRequest(
        @NotNull(message = "Enter your current password")
        String currentPassword) {}
