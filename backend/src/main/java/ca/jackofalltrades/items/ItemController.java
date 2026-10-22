package ca.jackofalltrades.items;

import ca.jackofalltrades.common.api.Ids;
import ca.jackofalltrades.common.api.Paginated;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Inventory endpoints (contract §3).
 *
 * <p>No {@code @Validated} on this class on purpose: without it, Spring MVC's built-in method
 * validation checks the parameter annotations and throws HandlerMethodValidationException,
 * which GlobalExceptionHandler turns into 400 "Validation failed". With {@code @Validated},
 * a different mechanism would throw ConstraintViolationException and the client would get 500.
 */
@RestController
@RequestMapping("/api/items")
public class ItemController {

    private final ItemService itemService;

    public ItemController(ItemService itemService) {
        this.itemService = itemService;
    }

    @GetMapping
    public Paginated<ItemResponse> list(
            @RequestParam(defaultValue = "1")
            @Min(value = 1, message = "Must be at least 1") int page,
            @RequestParam(defaultValue = "10")
            @Min(value = 1, message = "Must be at least 1")
            @Max(value = 100, message = "Must be at most 100") int pageSize,
            @RequestParam(required = false)
            @Size(max = 100, message = "Must be at most 100 characters") String search,
            @RequestParam(defaultValue = "id")
            @Pattern(regexp = "id|name|quantity|unitPriceCents",
                    message = "Must be one of id, name, quantity, unitPriceCents") String sort,
            @RequestParam(defaultValue = "asc")
            @Pattern(regexp = "asc|desc", message = "Must be one of asc, desc") String order) {
        String trimmed = search == null ? null : search.strip();
        return itemService.list(trimmed == null || trimmed.isEmpty() ? null : trimmed, sort, order, page, pageSize);
    }

    @GetMapping("/{id}")
    public ItemResponse get(@PathVariable String id) {
        return itemService.get(Ids.parse(id, "item id"));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ItemResponse create(@Valid @RequestBody ItemInput input) {
        return itemService.create(input);
    }

    /** Changes only the fields sent (at least one). */
    @PatchMapping("/{id}")
    public ItemResponse update(@PathVariable String id, @Valid @RequestBody ItemUpdate changes) {
        return itemService.update(Ids.parse(id, "item id"), changes);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        itemService.delete(Ids.parse(id, "item id"));
    }

    @PostMapping("/bulk-delete")
    public Map<String, Integer> bulkDelete(@Valid @RequestBody BulkDeleteRequest request) {
        return Map.of("deleted", itemService.bulkDelete(request.ids()));
    }
}
