package ca.jackofalltrades.common.api;

/** 400 with a message for the user, e.g. "Item 7 does not exist". */
public class BadRequestException extends RuntimeException {

    public BadRequestException(String message) {
        super(message);
    }
}
