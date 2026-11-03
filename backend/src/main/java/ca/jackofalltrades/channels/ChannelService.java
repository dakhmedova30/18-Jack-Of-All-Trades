package ca.jackofalltrades.channels;

import ca.jackofalltrades.common.api.ConflictException;
import ca.jackofalltrades.common.api.NotFoundException;
import ca.jackofalltrades.common.security.CurrentBusiness;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ChannelService {

    /** Every new business starts with these (contract §2, §4.1), as in the demo's starterNamedLists.ts. */
    public static final List<String> STARTER_CHANNELS = List.of("In person", "Online", "Commission", "Misc");

    private final ChannelRepository channels;
    private final CurrentBusiness currentBusiness;
    private final JdbcClient jdbcClient;

    public ChannelService(ChannelRepository channels, CurrentBusiness currentBusiness, JdbcClient jdbcClient) {
        this.channels = channels;
        this.currentBusiness = currentBusiness;
        this.jdbcClient = jdbcClient;
    }

    @Transactional(readOnly = true)
    public List<ChannelResponse> list() {
        return channels.findByBusinessIdOrderByIdAsc(currentBusiness.id()).stream()
                .map(ChannelResponse::from)
                .toList();
    }

    @Transactional
    public ChannelResponse create(ChannelRequest request) {
        Integer businessId = currentBusiness.id();
        if (channels.existsByBusinessIdAndNameIgnoreCase(businessId, request.name())) {
            throw alreadyExists(request.name());
        }
        try {
            // IDENTITY ids make save() insert immediately, so a concurrent duplicate fails here.
            return ChannelResponse.from(channels.save(new Channel(businessId, request.name())));
        } catch (DataIntegrityViolationException e) {
            throw alreadyExists(request.name());
        }
    }

    @Transactional
    public ChannelResponse rename(int id, ChannelRequest request) {
        Integer businessId = currentBusiness.id();
        Channel channel = channels.findByIdAndBusinessId(id, businessId)
                .orElseThrow(() -> new NotFoundException("Channel", id));
        // Changing only the capitalisation is fine; the name just can't match a different channel.
        boolean sameName = channel.getName().equalsIgnoreCase(request.name());
        if (!sameName && channels.existsByBusinessIdAndNameIgnoreCase(businessId, request.name())) {
            throw alreadyExists(request.name());
        }
        channel.setName(request.name());
        return ChannelResponse.from(channels.save(channel));
    }

    /** Sales point at their channel, so a channel with sales can't go; renaming it is the way out. */
    @Transactional
    public void delete(int id) {
        Channel channel = channels.findByIdAndBusinessId(id, currentBusiness.id())
                .orElseThrow(() -> new NotFoundException("Channel", id));
        long sales = jdbcClient.sql("SELECT COUNT(*) FROM sales WHERE channel_id = :id")
                .param("id", id)
                .query(Long.class)
                .single();
        if (sales > 0) {
            throw new ConflictException("Channel \"" + channel.getName() + "\" is used by " + sales
                    + (sales == 1 ? " sale" : " sales") + ", so it can't be deleted. Rename it instead.");
        }
        channels.delete(channel);
    }

    /** Called when a business is created (register and the demo seeder). */
    @Transactional
    public void createStarterChannels(Integer businessId) {
        for (String name : STARTER_CHANNELS) {
            channels.save(new Channel(businessId, name));
        }
    }

    private static ConflictException alreadyExists(String name) {
        return new ConflictException("Channel \"" + name + "\" already exists");
    }
}
