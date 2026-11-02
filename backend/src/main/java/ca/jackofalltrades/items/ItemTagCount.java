package ca.jackofalltrades.items;

/** One tag in use on the business's items, and how many items carry it. */
public record ItemTagCount(String name, long itemCount) {}
