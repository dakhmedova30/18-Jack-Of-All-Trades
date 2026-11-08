package ca.jackofalltrades.markets;

import ca.jackofalltrades.common.api.Ids;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** In-person market endpoints. */
@RestController
@RequestMapping("/api/markets")
public class MarketController {

    private final MarketService markets;

    public MarketController(MarketService markets) {
        this.markets = markets;
    }

    public record BulkDeleteRequest(
            @NotNull(message = "Select at least one market")
            @Size(min = 1, message = "Select at least one market")
            @Size(max = 100, message = "At most 100 markets")
            List<@NotNull(message = "Required") @Positive(message = "Must be a positive number") Integer> ids) {}

    @GetMapping
    public List<MarketResponse> list() {
        return markets.list();
    }

    @GetMapping("/{id}")
    public MarketResponse get(@PathVariable String id) {
        return markets.get(Ids.parse(id, "market id"));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MarketResponse create(@Valid @RequestBody MarketInput input) {
        return markets.create(input);
    }

    @PatchMapping("/{id}")
    public MarketResponse replace(@PathVariable String id, @Valid @RequestBody MarketInput input) {
        return markets.replace(Ids.parse(id, "market id"), input);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        markets.delete(Ids.parse(id, "market id"));
    }

    @PostMapping("/bulk-delete")
    public Map<String, Integer> bulkDelete(@Valid @RequestBody BulkDeleteRequest request) {
        return Map.of("deleted", markets.bulkDelete(request.ids()));
    }
}
