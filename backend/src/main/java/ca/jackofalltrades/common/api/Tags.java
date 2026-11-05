package ca.jackofalltrades.common.api;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

/**
 * Tag lists on items, sales and expenses (contract §3: ≤ 10 tags, each 1–30 characters,
 * duplicates removed, default {@code []}). Call {@link #normalize} from a request record's
 * compact constructor; the limits go on the field:
 *
 * <pre>
 * &#64;Size(max = 10, message = "At most 10 tags")
 * List&lt;&#64;NotBlank(message = "Tags cannot be empty") &#64;Size(max = 30) String&gt; tags
 * </pre>
 */
public final class Tags {

    private Tags() {}

    /** {@code null} → {@code []}; trims each tag; drops repeats, keeping the first. Nulls are kept for validation to reject. */
    public static List<String> normalize(List<String> tags) {
        if (tags == null) {
            return List.of();
        }
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        for (String tag : tags) {
            unique.add(tag == null ? null : tag.strip());
        }
        return new ArrayList<>(unique);
    }
}
