package ca.jackofalltrades.items;

import java.util.List;

/** The {@code LowStock} JSON in contract §3. {@code count} covers every low item; {@code items} is capped by the limit. */
public record LowStock(long count, int threshold, List<LowItem> items) {

    public record LowItem(Integer id, String name, int quantity) {}
}
