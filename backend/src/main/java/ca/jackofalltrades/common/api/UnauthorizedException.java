package ca.jackofalltrades.common.api;

/** 401, e.g. "Incorrect email or password" or "Not logged in". */
public class UnauthorizedException extends RuntimeException {

    public UnauthorizedException(String message) {
        super(message);
    }
}
