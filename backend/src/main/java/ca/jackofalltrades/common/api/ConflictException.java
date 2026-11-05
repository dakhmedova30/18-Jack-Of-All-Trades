package ca.jackofalltrades.common.api;

/** 409 with a user-facing message, e.g. {@code Channel "Etsy" already exists}. */
public class ConflictException extends RuntimeException {

    public ConflictException(String message) {
        super(message);
    }
}
