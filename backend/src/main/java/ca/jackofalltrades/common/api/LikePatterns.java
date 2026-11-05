package ca.jackofalltrades.common.api;

/** Search patterns for SQL {@code ILIKE}, shared by the list queries. */
public final class LikePatterns {

    private LikePatterns() {}

    /** {@code "%" + value + "%"}, with %, _ and \ escaped so they match literally. */
    public static String contains(String value) {
        return "%" + value.replaceAll("([\\\\%_])", "\\\\$1") + "%";
    }
}
