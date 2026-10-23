package ca.jackofalltrades.channels;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** {@code POST /api/channels} body (contract §4.1). The name is trimmed before validation. */
public record ChannelRequest(
        @NotBlank(message = "Name is required")
        @Size(max = 40, message = "Name must be at most 40 characters")
        String name) {

    public ChannelRequest {
        name = name == null ? null : name.strip();
    }
}
