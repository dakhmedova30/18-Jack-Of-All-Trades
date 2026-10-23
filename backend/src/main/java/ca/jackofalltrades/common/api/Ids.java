package ca.jackofalltrades.common.api;

/** Parses a path id like the demo's parseIdParam.ts: a positive integer, otherwise 400. */
public final class Ids {

    private Ids() {}

    /** {@code Ids.parse("abc", "item id")} → 400 {@code Invalid item id: "abc"}. */
    public static int parse(String rawId, String resource) {
        try {
            int id = Integer.parseInt(rawId);
            if (id > 0) {
                return id;
            }
        } catch (NumberFormatException ignored) {
            // falls through to the 400 below
        }
        throw new BadRequestException("Invalid " + resource + ": \"" + rawId + "\"");
    }
}
