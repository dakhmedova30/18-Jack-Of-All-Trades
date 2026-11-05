package ca.jackofalltrades.sales;

import ca.jackofalltrades.channels.ChannelResponse;
import java.time.Instant;
import java.util.List;

/** The {@code Sale} JSON in contract §4. {@code totalCents} is the sum of the lines. */
public record SaleResponse(
        Integer id,
        Instant soldAt,
        ChannelResponse channel,
        String description,
        List<String> tags,
        long totalCents,
        List<SaleLineResponse> items,
        Instant createdAt,
        Instant updatedAt) {

    static SaleResponse from(Sale sale) {
        List<SaleLineResponse> lines = sale.getLines().stream().map(SaleLineResponse::from).toList();
        return of(sale.getId(), sale.getSoldAt(), ChannelResponse.from(sale.getChannel()), sale.getDescription(),
                List.copyOf(sale.getTags()), lines, sale.getCreatedAt(), sale.getUpdatedAt());
    }

    static SaleResponse of(Integer id, Instant soldAt, ChannelResponse channel, String description,
            List<String> tags, List<SaleLineResponse> lines, Instant createdAt, Instant updatedAt) {
        long total = lines.stream().mapToLong(SaleLineResponse::totalCents).sum();
        return new SaleResponse(id, soldAt, channel, description, tags, total, lines, createdAt, updatedAt);
    }
}
