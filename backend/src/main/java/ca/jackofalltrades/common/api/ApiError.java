package ca.jackofalltrades.common.api;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/**
 * Every error response: {@code { "error": { "message": "...", "details": [...] } }}.
 * {@code details} is only present for validation errors (contract §1).
 */
public record ApiError(Body error) {

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Body(String message, List<FieldError> details) {}

    public static ApiError of(String message) {
        return new ApiError(new Body(message, null));
    }

    public static ApiError of(String message, List<FieldError> details) {
        return new ApiError(new Body(message, details));
    }
}
