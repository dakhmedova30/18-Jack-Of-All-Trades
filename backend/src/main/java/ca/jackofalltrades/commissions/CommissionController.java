package ca.jackofalltrades.commissions;

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

/** Commission records and their sales/expense links. */
@RestController
@RequestMapping("/api/commissions")
public class CommissionController {

    private final CommissionService commissions;

    public CommissionController(CommissionService commissions) {
        this.commissions = commissions;
    }

    public record BulkDeleteRequest(
            @NotNull(message = "Select at least one commission")
            @Size(min = 1, message = "Select at least one commission")
            @Size(max = 100, message = "At most 100 commissions")
            List<@NotNull(message = "Required") @Positive(message = "Must be a positive number") Integer> ids) {}

    public record ExpenseBulkDeleteRequest(
            @NotNull(message = "Select at least one expense")
            @Size(min = 1, message = "Select at least one expense")
            @Size(max = 100, message = "At most 100 expenses")
            List<@NotNull(message = "Required") @Positive(message = "Must be a positive number") Integer> ids) {}

    public record UnassignedExpenseBulkDeleteRequest(
            @NotNull(message = "Select at least one expense")
            @Size(min = 1, message = "Select at least one expense")
            @Size(max = 100, message = "At most 100 expenses")
            List<@NotNull(message = "Required") @Positive(message = "Must be a positive number") Integer> ids) {}

    @GetMapping
    public List<CommissionResponse> list() {
        return commissions.list();
    }

    @GetMapping("/{id}")
    public CommissionResponse get(@PathVariable String id) {
        return commissions.get(Ids.parse(id, "commission id"));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CommissionResponse create(@Valid @RequestBody CommissionInput input) {
        return commissions.create(input);
    }

    @PatchMapping("/{id}")
    public CommissionResponse replace(@PathVariable String id, @Valid @RequestBody CommissionInput input) {
        return commissions.replace(Ids.parse(id, "commission id"), input);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        commissions.delete(Ids.parse(id, "commission id"));
    }

    @PostMapping("/bulk-delete")
    public Map<String, Integer> bulkDelete(@Valid @RequestBody BulkDeleteRequest request) {
        return Map.of("deleted", commissions.bulkDelete(request.ids()));
    }

    @GetMapping("/expenses/unassigned")
    public List<CommissionExpenseResponse> unassignedExpenses() {
        return commissions.unassignedExpenses();
    }

    @DeleteMapping("/expenses/unassigned/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteUnassignedExpense(@PathVariable String id) {
        commissions.deleteUnassignedExpense(Ids.parse(id, "expense id"));
    }

    @PostMapping("/expenses/unassigned/bulk-delete")
    public Map<String, Integer> bulkDeleteUnassignedExpenses(
            @Valid @RequestBody UnassignedExpenseBulkDeleteRequest request) {
        return Map.of("deleted", commissions.bulkDeleteUnassignedExpenses(request.ids()));
    }

    @GetMapping("/{commissionId}/expenses")
    public List<CommissionExpenseResponse> expenses(@PathVariable String commissionId) {
        return commissions.expenses(Ids.parse(commissionId, "commission id"));
    }

    @PostMapping("/{commissionId}/expenses")
    @ResponseStatus(HttpStatus.CREATED)
    public CommissionExpenseResponse createExpense(
            @PathVariable String commissionId, @Valid @RequestBody CommissionExpenseInput input) {
        return commissions.createExpense(Ids.parse(commissionId, "commission id"), input);
    }

    @PatchMapping("/{commissionId}/expenses/{id}")
    public CommissionExpenseResponse replaceExpense(
            @PathVariable String commissionId, @PathVariable String id, @Valid @RequestBody CommissionExpenseInput input) {
        return commissions.replaceExpense(Ids.parse(commissionId, "commission id"),
                Ids.parse(id, "expense id"), input);
    }

    @DeleteMapping("/{commissionId}/expenses/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteExpense(@PathVariable String commissionId, @PathVariable String id) {
        commissions.deleteExpense(Ids.parse(commissionId, "commission id"), Ids.parse(id, "expense id"));
    }

    @PostMapping("/{commissionId}/expenses/bulk-delete")
    public Map<String, Integer> bulkDeleteExpenses(
            @PathVariable String commissionId, @Valid @RequestBody ExpenseBulkDeleteRequest request) {
        return Map.of("deleted", commissions.bulkDeleteExpenses(
                Ids.parse(commissionId, "commission id"), request.ids()));
    }
}
