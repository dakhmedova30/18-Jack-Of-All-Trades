package ca.jackofalltrades.items;

import ca.jackofalltrades.common.api.Tags;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * {@code POST /api/items} body (contract §3). Limits and messages follow the demo's
 * items.schema.ts. The compact constructor trims before validation runs.
 */
public record ItemInput(
        @NotNull(message = "Required")
        @Size(min = 1, message = "Name is required")
        @Size(max = 120, message = "Name must be at most 120 characters")
        String name,

        @NotNull(message = "Required")
        @Min(value = 0, message = "Quantity cannot be negative")
        Integer quantity,

        @NotNull(message = "Required")
        @Min(value = 0, message = "Price must be between 0.00 and 9,999,999.99")
        @Max(value = 999_999_999, message = "Price must be between 0.00 and 9,999,999.99")
        Integer unitPriceCents,

        @Size(max = 10, message = "At most 10 tags")
        List<@NotBlank(message = "Tags cannot be empty") @Size(max = 30, message = "Tags must be at most 30 characters")
                @Pattern(regexp = TAG_CHARACTERS, message = TAG_CHARACTERS_MESSAGE) String> tags,

        @Size(max = 1000, message = "Note must be at most 1000 characters")
        String note,

        /** Optional; omitted means private. */
        Boolean isPublic) {

    /**
     * The characters an item tag may use: letters and numbers in any language, spaces, and
     * {@code & - _ / # : ' ’ . + % ( ) !}. Never a comma: the item form separates tags with
     * commas (a comma tag would split in two on its next save), and {@code ?tag=} splits on them.
     * The frontend's utils/itemTags.ts has the same rule.
     */
    static final String TAG_CHARACTERS = "[\\p{L}\\p{M}\\p{N} &_/#:'’.+%()!-]*";
    static final String TAG_CHARACTERS_MESSAGE =
            "Tags can only use letters, numbers, spaces and & - _ / # : ' . + % ( ) !";

    public ItemInput {
        name = name == null ? null : name.strip();
        tags = Tags.normalize(tags);
        note = note == null ? "" : note;
        isPublic = isPublic != null && isPublic;
    }
}
