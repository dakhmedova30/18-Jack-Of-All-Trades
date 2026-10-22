package ca.jackofalltrades.channels;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Channels (contract §4.1): the business's list, oldest first, and adding one. */
@RestController
@RequestMapping("/api/channels")
public class ChannelController {

    private final ChannelService channelService;

    public ChannelController(ChannelService channelService) {
        this.channelService = channelService;
    }

    @GetMapping
    public List<ChannelResponse> list() {
        return channelService.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ChannelResponse create(@Valid @RequestBody ChannelRequest request) {
        return channelService.create(request);
    }
}
