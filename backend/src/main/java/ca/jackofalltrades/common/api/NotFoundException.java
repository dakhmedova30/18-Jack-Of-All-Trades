package ca.jackofalltrades.common.api;

/** 404, e.g. {@code new NotFoundException("Item", 7)} → "Item 7 not found". */
public class NotFoundException extends RuntimeException {

    public NotFoundException(String resource, Object id) {
        super(resource + " " + id + " not found");
    }
}
