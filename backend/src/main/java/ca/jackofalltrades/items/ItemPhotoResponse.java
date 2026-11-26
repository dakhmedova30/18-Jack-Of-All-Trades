package ca.jackofalltrades.items;

import java.time.Instant;

/** The result of setting or removing an item's photo: its URL, or null when there is none. */
public record ItemPhotoResponse(String photoUrl) {

    /** {@code /api/items/5/photo?v=<millis>}: the version changes whenever the photo does, so browsers refetch it. */
    static String url(int itemId, Instant updatedAt) {
        return updatedAt == null ? null : "/api/items/" + itemId + "/photo?v=" + updatedAt.toEpochMilli();
    }
}
