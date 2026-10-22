package ca.jackofalltrades.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Locale;

/**
 * {@code POST /api/auth/register} body (contract §2). Messages follow the demo's auth.schema.ts.
 * The compact constructor trims (and lowercases the email) before validation runs.
 */
public record RegisterRequest(
        @NotBlank(message = "Business name is required")
        @Size(max = 120, message = "Business name must be at most 120 characters")
        String name,

        @NotBlank(message = "Enter a valid email")
        @Email(message = "Enter a valid email")
        @Size(max = 255, message = "Email must be at most 255 characters")
        String email,

        @NotNull(message = "Password must be at least 8 characters")
        @Size(min = 8, message = "Password must be at least 8 characters")
        @Size(max = 200, message = "Password must be at most 200 characters")
        String password) {

    public RegisterRequest {
        name = name == null ? null : name.strip();
        email = email == null ? null : email.strip().toLowerCase(Locale.ROOT);
    }
}
