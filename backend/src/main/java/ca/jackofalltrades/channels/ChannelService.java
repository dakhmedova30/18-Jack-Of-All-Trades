package ca.jackofalltrades.channels;

import ca.jackofalltrades.common.api.ConflictException;
import ca.jackofalltrades.common.security.CurrentBusiness;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ChannelService {

    /** Every new business starts with these (contract §2, §4.1), as in the demo's starterNamedLists.ts. */
    public static final List<String> STARTER_CHANNELS = List.of("In person", "Online", "Commission", "Misc");

    private final ChannelRepository channels;
    private final CurrentBusiness currentBusiness;

    public ChannelService(ChannelRepository channels, CurrentBusiness currentBusiness) {
        this.channels = channels;
        this.currentBusiness = currentBusiness;
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
