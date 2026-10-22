package ca.jackofalltrades.channels;

/** The {@code Channel} JSON in contract §4.1, also embedded in each sale. */
public record ChannelResponse(Integer id, String name) {

    public static ChannelResponse from(Channel channel) {
        return new ChannelResponse(channel.getId(), channel.getName());
    }
}
