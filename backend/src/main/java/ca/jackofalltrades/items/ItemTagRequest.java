package ca.jackofalltrades.items;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** {@code PUT /api/items/tags} body: the tag's new name. Trimmed before validation, like item tags. */
public record ItemTagRequest(
        @NotBlank(message = "Name is required")
        @Size(max = 30, message = "Name must be at most 30 characters")
        String name) {

    public ItemTagRequest {
        name = name == null ? null : name.strip();
    }
}
