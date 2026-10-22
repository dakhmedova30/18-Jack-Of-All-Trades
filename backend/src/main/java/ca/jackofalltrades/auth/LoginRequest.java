package ca.jackofalltrades.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.Locale;

/** {@code POST /api/auth/login} body (contract §2). Messages follow the demo's auth.schema.ts. */
public record LoginRequest(
        @NotBlank(message = "Enter a valid email")
        @Email(message = "Enter a valid email")
        @Size(max = 255, message = "Email must be at most 255 characters")
        String email,

        @NotEmpty(message = "Password is required")
        @Size(max = 200, message = "Password must be at most 200 characters")
        String password) {

    public LoginRequest {
        email = email == null ? null : email.strip().toLowerCase(Locale.ROOT);
    }
}
