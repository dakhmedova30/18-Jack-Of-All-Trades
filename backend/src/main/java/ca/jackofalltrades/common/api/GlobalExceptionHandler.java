package ca.jackofalltrades.common.api;

import jakarta.servlet.http.HttpServletRequest;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.exc.MismatchedInputException;

/**
 * Turns every exception into the contract's error format (contract §1). Messages match
 * the TypeScript demo's errorHandler.ts. Modules throw; they never build error responses.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** Postgres SQL states caused by bad input rather than a server bug (from errorHandler.ts). */
    private static final Map<String, String> POSTGRES_CLIENT_ERRORS = Map.of(
            "23503", "Referenced record does not exist",
            "23505", "A record with that value already exists",
            "23514", "Value is not allowed",
            "22003", "Number is out of range");

    /** Field types the contract calls whole numbers: ids, quantities and cents. */
    private static final Set<Class<?>> WHOLE_NUMBER_TYPES =
            Set.of(Integer.class, int.class, Long.class, long.class, Short.class, short.class);

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> invalidBody(MethodArgumentNotValidException ex) {
        List<FieldError> details = ex.getBindingResult().getAllErrors().stream()
                .map(error -> new FieldError(
                        error instanceof org.springframework.validation.FieldError fieldError
                                ? toDottedPath(fieldError.getField())
                                : "",
                        error.getDefaultMessage()))
                .toList();
        return respond(HttpStatus.BAD_REQUEST, ApiError.of("Validation failed", details));
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    ResponseEntity<ApiError> invalidParameters(HandlerMethodValidationException ex) {
        List<FieldError> details = ex.getParameterValidationResults().stream()
                .flatMap(result -> result.getResolvableErrors().stream()
                        .map(error -> new FieldError(
                                result.getMethodParameter().getParameterName(),
                                error.getDefaultMessage())))
                .toList();
        return respond(HttpStatus.BAD_REQUEST, ApiError.of("Validation failed", details));
    }

    /**
     * A body Jackson couldn't map. A whole-number field given a decimal, a string or anything
     * else (see spring.jackson in application.yml) is a field error, as the demo's
     * {@code z.number().int()}; any other problem is "Request body is not valid JSON".
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ApiError> unreadableBody(HttpMessageNotReadableException ex) {
        for (Throwable cause = ex; cause != null; cause = cause.getCause()) {
            if (cause instanceof MismatchedInputException mismatch
                    && WHOLE_NUMBER_TYPES.contains(mismatch.getTargetType())) {
                FieldError detail = new FieldError(jsonPath(mismatch.getPath()), "Must be a whole number");
                return respond(HttpStatus.BAD_REQUEST, ApiError.of("Validation failed", List.of(detail)));
            }
        }
        return respond(HttpStatus.BAD_REQUEST, ApiError.of("Request body is not valid JSON"));
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    ResponseEntity<ApiError> unsupportedMediaType() {
        return respond(HttpStatus.BAD_REQUEST, ApiError.of("Request body is not valid JSON"));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<ApiError> wrongType(MethodArgumentTypeMismatchException ex) {
        return respond(HttpStatus.BAD_REQUEST, ApiError.of("Invalid value for '" + ex.getName() + "'"));
    }

    @ExceptionHandler(BadRequestException.class)
    ResponseEntity<ApiError> badRequest(BadRequestException ex) {
        return respond(HttpStatus.BAD_REQUEST, ApiError.of(ex.getMessage()));
    }

    @ExceptionHandler(UnauthorizedException.class)
    ResponseEntity<ApiError> unauthorized(UnauthorizedException ex) {
        return respond(HttpStatus.UNAUTHORIZED, ApiError.of(ex.getMessage()));
    }

    @ExceptionHandler(ConflictException.class)
    ResponseEntity<ApiError> conflict(ConflictException ex) {
        return respond(HttpStatus.CONFLICT, ApiError.of(ex.getMessage()));
    }

    @ExceptionHandler(NotFoundException.class)
    ResponseEntity<ApiError> notFound(NotFoundException ex) {
        return respond(HttpStatus.NOT_FOUND, ApiError.of(ex.getMessage()));
    }

    /** No route matches the path, or none matches the method (the demo answers both with 404). */
    @ExceptionHandler({NoResourceFoundException.class, HttpRequestMethodNotSupportedException.class})
    ResponseEntity<ApiError> noRoute(HttpServletRequest request) {
        return respond(HttpStatus.NOT_FOUND,
                ApiError.of("Route " + request.getMethod() + " " + request.getRequestURI() + " not found"));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ApiError> constraintViolation(DataIntegrityViolationException ex) {
        SQLException sqlException = findSqlException(ex);
        String state = sqlException == null ? null : sqlException.getSQLState();
        String message;
        if ("23514".equals(state) && sqlException.getMessage().contains("items_quantity_check")) {
            message = "Not enough stock";
        } else {
            message = POSTGRES_CLIENT_ERRORS.getOrDefault(state, "Invalid value");
        }
        return respond(HttpStatus.BAD_REQUEST, ApiError.of(message));
    }

    @ExceptionHandler(DataAccessResourceFailureException.class)
    ResponseEntity<ApiError> databaseUnavailable(DataAccessResourceFailureException ex) {
        log.error("Database unreachable", ex);
        return respond(HttpStatus.SERVICE_UNAVAILABLE, ApiError.of("Database is unavailable, try again shortly"));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> unexpected(Exception ex) {
        log.error("Unhandled error", ex);
        return respond(HttpStatus.INTERNAL_SERVER_ERROR, ApiError.of("Internal server error"));
    }

    /** Jackson's path to the bad value, in the contract's form: {@code items.1.quantity}. */
    private static String jsonPath(List<JacksonException.Reference> path) {
        return path.stream()
                .map(ref -> ref.getPropertyName() != null ? ref.getPropertyName() : String.valueOf(ref.getIndex()))
                .collect(Collectors.joining("."));
    }

    /** Bean Validation writes list elements as {@code items[1].quantity}; the contract uses {@code items.1.quantity}. */
    static String toDottedPath(String path) {
        return path.replaceAll("\\[(\\d+)]", ".$1");
    }

    private static SQLException findSqlException(Throwable ex) {
        for (Throwable cause = ex; cause != null; cause = cause.getCause()) {
            if (cause instanceof SQLException sqlException && sqlException.getSQLState() != null) {
                return sqlException;
            }
        }
        return null;
    }

    private static ResponseEntity<ApiError> respond(HttpStatus status, ApiError body) {
        return ResponseEntity.status(status).body(body);
    }
}
