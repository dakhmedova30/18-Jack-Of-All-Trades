package ca.jackofalltrades.miscellaneous;

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

@RestController
@RequestMapping("/api/miscellaneous")
public class MiscellaneousController {

    private final MiscellaneousService miscellaneous;

    public MiscellaneousController(MiscellaneousService miscellaneous) {
        this.miscellaneous = miscellaneous;
    }

    public record BulkDeleteRequest(
            @NotNull(message = "Select at least one record")
            @Size(min = 1, message = "Select at least one record")
            @Size(max = 100, message = "At most 100 records")
            List<@NotNull(message = "Required") @Positive(message = "Must be a positive number") Integer> ids) {}

    public record ExpenseBulkDeleteRequest(
            @NotNull(message = "Select at least one expense")
            @Size(min = 1, message = "Select at least one expense")
            @Size(max = 100, message = "At most 100 expenses")
            List<@NotNull(message = "Required") @Positive(message = "Must be a positive number") Integer> ids) {}

    @GetMapping
    public List<MiscellaneousResponse> list() {
        return miscellaneous.list();
    }

    @GetMapping("/{id}")
    public MiscellaneousResponse get(@PathVariable String id) {
        return miscellaneous.get(Ids.parse(id, "miscellaneous id"));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MiscellaneousResponse create(@Valid @RequestBody MiscellaneousInput input) {
        return miscellaneous.create(input);
    }

    @PatchMapping("/{id}")
    public MiscellaneousResponse replace(@PathVariable String id, @Valid @RequestBody MiscellaneousInput input) {
        return miscellaneous.replace(Ids.parse(id, "miscellaneous id"), input);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        miscellaneous.delete(Ids.parse(id, "miscellaneous id"));
    }

    @PostMapping("/bulk-delete")
    public Map<String, Integer> bulkDelete(@Valid @RequestBody BulkDeleteRequest request) {
        return Map.of("deleted", miscellaneous.bulkDelete(request.ids()));
    }

    @GetMapping("/{miscId}/expenses")
    public List<MiscExpenseResponse> expenses(@PathVariable String miscId) {
        return miscellaneous.expenses(Ids.parse(miscId, "miscellaneous id"));
    }

    @PostMapping("/{miscId}/expenses")
    @ResponseStatus(HttpStatus.CREATED)
    public MiscExpenseResponse createExpense(
            @PathVariable String miscId, @Valid @RequestBody MiscExpenseInput input) {
        return miscellaneous.createExpense(Ids.parse(miscId, "miscellaneous id"), input);
    }

    @PatchMapping("/{miscId}/expenses/{id}")
    public MiscExpenseResponse replaceExpense(
            @PathVariable String miscId, @PathVariable String id, @Valid @RequestBody MiscExpenseInput input) {
        return miscellaneous.replaceExpense(Ids.parse(miscId, "miscellaneous id"),
                Ids.parse(id, "expense id"), input);
    }

    @DeleteMapping("/{miscId}/expenses/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteExpense(@PathVariable String miscId, @PathVariable String id) {
        miscellaneous.deleteExpense(Ids.parse(miscId, "miscellaneous id"), Ids.parse(id, "expense id"));
    }

    @PostMapping("/{miscId}/expenses/bulk-delete")
    public Map<String, Integer> bulkDeleteExpenses(
            @PathVariable String miscId, @Valid @RequestBody ExpenseBulkDeleteRequest request) {
        return Map.of("deleted", miscellaneous.bulkDeleteExpenses(
                Ids.parse(miscId, "miscellaneous id"), request.ids()));
    }

    @GetMapping("/expenses/unassigned")
    public List<MiscExpenseResponse> unassignedExpenses() {
        return miscellaneous.unassignedExpenses();
    }

    @DeleteMapping("/expenses/unassigned/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteUnassignedExpense(@PathVariable String id) {
        miscellaneous.deleteUnassignedExpense(Ids.parse(id, "expense id"));
    }

    @PostMapping("/expenses/unassigned/bulk-delete")
    public Map<String, Integer> bulkDeleteUnassignedExpenses(
            @Valid @RequestBody ExpenseBulkDeleteRequest request) {
        return Map.of("deleted", miscellaneous.bulkDeleteUnassignedExpenses(request.ids()));
    }
}
