package ca.jackofalltrades.miscellaneous;

import ca.jackofalltrades.common.api.Tags;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;

public record MiscellaneousInput(
        @NotBlank(message = "Name is required")
        @Size(max = 120, message = "Name must be at most 120 characters")
        String name,
        LocalDate receivedOn,
        @Size(max = 10, message = "At most 10 tags")
        List<@NotBlank(message = "Tags cannot be empty") @Size(max = 30, message = "Tags must be at most 30 characters") String> tags) {

    public MiscellaneousInput {
        name = name == null ? null : name.strip();
        tags = Tags.normalize(tags);
    }

    public MiscellaneousInput(String name, List<String> tags) {
        this(name, null, tags);
    }
}
