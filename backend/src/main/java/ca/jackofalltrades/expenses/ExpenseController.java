package ca.jackofalltrades.expenses;

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

/** Expenses endpoints (contract §5). No {@code @Validated}, for the reason given on ItemController. */
@RestController
@RequestMapping("/api/expenses")
public class ExpenseController {

    private final ExpenseService expenseService;

    public ExpenseController(ExpenseService expenseService) {
        this.expenseService = expenseService;
    }

    @GetMapping
    public Paginated<ExpenseResponse> list(
            @RequestParam(defaultValue = "1")
            @Min(value = 1, message = "Must be at least 1") int page,
            @RequestParam(defaultValue = "10")
            @Min(value = 1, message = "Must be at least 1")
            @Max(value = 100, message = "Must be at most 100") int pageSize,
            @RequestParam(required = false)
            @Size(max = 100, message = "Must be at most 100 characters") String search,
            @RequestParam(defaultValue = "incurredAt")
            @Pattern(regexp = "id|incurredAt|total|tags",
                    message = "Must be one of id, incurredAt, total, tags") String sort,
            @RequestParam(defaultValue = "desc")
            @Pattern(regexp = "asc|desc", message = "Must be one of asc, desc") String order) {
        String trimmed = search == null ? null : search.strip();
        return expenseService.list(trimmed == null || trimmed.isEmpty() ? null : trimmed, sort, order, page, pageSize);
    }

    /** A literal path, so Spring matches it before {@code /{id}}; "month-breakdown" is never parsed as an id. */
    @GetMapping("/month-breakdown")
    public ExpenseMonthBreakdown monthBreakdown() {
        return expenseService.monthBreakdown();
    }

    @GetMapping("/{id}")
    public ExpenseResponse get(@PathVariable String id) {
        return expenseService.get(Ids.parse(id, "expense id"));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ExpenseResponse record(@Valid @RequestBody ExpenseInput input) {
        return expenseService.record(input);
    }

    /** Replaces the whole expense, including all its lines. */
    @PatchMapping("/{id}")
    public ExpenseResponse replace(@PathVariable String id, @Valid @RequestBody ExpenseInput input) {
        return expenseService.replace(Ids.parse(id, "expense id"), input);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        expenseService.delete(Ids.parse(id, "expense id"));
    }

    @PostMapping("/bulk-delete")
    public Map<String, Integer> bulkDelete(@Valid @RequestBody BulkDeleteRequest request) {
        return Map.of("deleted", expenseService.bulkDelete(request.ids()));
    }
}
