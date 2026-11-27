package ca.jackofalltrades.discounts;

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

/** Discount and charge library endpoints. */
@RestController
@RequestMapping("/api/discounts")
public class DiscountController {

    private final DiscountService discounts;

    public DiscountController(DiscountService discounts) {
        this.discounts = discounts;
    }

    public record BulkDeleteRequest(
            @NotNull(message = "Select at least one discount")
            @Size(min = 1, message = "Select at least one discount")
            @Size(max = 100, message = "At most 100 discounts")
            List<@NotNull(message = "Required") @Positive(message = "Must be a positive number") Integer> ids) {}

    @GetMapping
    public List<DiscountResponse> list() {
        return discounts.list();
    }

    /** A literal path, so Spring matches it before {@code /{id}}. */
    @GetMapping("/applies-to")
    public List<String> appliesTo() {
        return discounts.appliesToOptions();
    }

    @GetMapping("/{id}")
    public DiscountResponse get(@PathVariable String id) {
        return discounts.get(Ids.parse(id, "discount id"));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DiscountResponse create(@Valid @RequestBody DiscountInput input) {
        return discounts.create(input);
    }

    @PatchMapping("/{id}")
    public DiscountResponse replace(@PathVariable String id, @Valid @RequestBody DiscountInput input) {
        return discounts.replace(Ids.parse(id, "discount id"), input);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        discounts.delete(Ids.parse(id, "discount id"));
    }

    @PostMapping("/bulk-delete")
    public Map<String, Integer> bulkDelete(@Valid @RequestBody BulkDeleteRequest request) {
        return Map.of("deleted", discounts.bulkDelete(request.ids()));
    }
}
