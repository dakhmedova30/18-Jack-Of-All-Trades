package ca.jackofalltrades.common.api;

import java.util.List;

/** A page of results: {@code { data, page, pageSize, total, totalPages }} (contract §1). */
public record Paginated<T>(List<T> data, int page, int pageSize, long total, long totalPages) {

    /** {@code totalPages} is at least 1, even when there are no results. */
    public static <T> Paginated<T> of(List<T> data, int page, int pageSize, long total) {
        long totalPages = Math.max(1, (total + pageSize - 1) / pageSize);
        return new Paginated<>(data, page, pageSize, total, totalPages);
    }
}
