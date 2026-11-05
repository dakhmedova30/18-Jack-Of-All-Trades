package ca.jackofalltrades.auth;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** {@code PUT /api/auth/me/password} body. The new password follows the registration rules. */
public record ChangePasswordRequest(
        @NotNull(message = "Enter your current password")
        String currentPassword,

        @NotNull(message = "Password must be at least 8 characters")
        @Size(min = 8, message = "Password must be at least 8 characters")
        @Size(max = 200, message = "Password must be at most 200 characters")
        String newPassword) {}
