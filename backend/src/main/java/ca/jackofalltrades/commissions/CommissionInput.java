package ca.jackofalltrades.commissions;

import ca.jackofalltrades.common.api.Tags;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;

/** {@code POST /api/commissions} and {@code PATCH /api/commissions/{id}} body. */
public record CommissionInput(
        @NotBlank(message = "Name is required")
        @Size(max = 120, message = "Name must be at most 120 characters")
        String name,

        @Size(max = 200, message = "Contact must be at most 200 characters")
        String contact,

        @Size(max = 1000, message = "Request must be at most 1000 characters")
        String request,

        @NotNull(message = "Required") LocalDate deadline,

        @Size(max = 10, message = "At most 10 tags")
        List<@NotBlank(message = "Tags cannot be empty") @Size(max = 30, message = "Tags must be at most 30 characters") String> tags) {

    public CommissionInput {
        name = name == null ? null : name.strip();
        contact = contact == null ? "" : contact.strip();
        request = request == null ? "" : request.strip();
        tags = Tags.normalize(tags);
    }
}
