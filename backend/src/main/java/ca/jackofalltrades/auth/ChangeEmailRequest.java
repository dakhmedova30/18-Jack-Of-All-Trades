package ca.jackofalltrades.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Locale;

/** {@code PUT /api/auth/me/email} body: the new email, confirmed with the current password. */
public record ChangeEmailRequest(
        @NotBlank(message = "Enter a valid email")
        @Email(message = "Enter a valid email")
        @Size(max = 255, message = "Email must be at most 255 characters")
        String email,

        @NotNull(message = "Enter your current password")
        String currentPassword) {

    public ChangeEmailRequest {
        email = email == null ? null : email.strip().toLowerCase(Locale.ROOT);
    }
}
