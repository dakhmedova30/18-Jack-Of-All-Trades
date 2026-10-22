package ca.jackofalltrades.common.api;

/** One validation problem; {@code field} is a dotted path such as {@code items.1.quantity}. */
public record FieldError(String field, String message) {}
