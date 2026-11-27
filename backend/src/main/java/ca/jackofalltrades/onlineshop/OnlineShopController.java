package ca.jackofalltrades.onlineshop;

import ca.jackofalltrades.common.api.Ids;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Online shop endpoints: the monthly overview and the shop's expense entries. */
@RestController
@RequestMapping("/api/online-shop")
public class OnlineShopController {

    private final OnlineShopService shop;

    public OnlineShopController(OnlineShopService shop) {
        this.shop = shop;
    }

    public record BulkDeleteRequest(
            @NotNull(message = "Select at least one entry")
            @Size(min = 1, message = "Select at least one entry")
            @Size(max = 100, message = "At most 100 entries")
            List<@NotNull(message = "Required") @Positive(message = "Must be a positive number") Integer> ids) {}

    public record MonthsDeleteRequest(
            @NotNull(message = "Select at least one month")
            @Size(min = 1, message = "Select at least one month")
            @Size(max = 100, message = "At most 100 months")
            List<@NotNull(message = "Required") String> months) {}

    @GetMapping("/months")
    public List<OnlineMonthResponse> months(
            @RequestParam(defaultValue = "CAD")
            @Pattern(regexp = "CAD|USD|EUR|GBP|AUD", message = "Currency must be one of: CAD, USD, EUR, GBP, AUD")
            String currency) {
        return shop.months(currency);
    }

    @PostMapping("/months/bulk-delete")
    public Map<String, Integer> deleteMonths(@Valid @RequestBody MonthsDeleteRequest request) {
        return Map.of("deleted", shop.deleteMonths(request.months()));
    }

    @GetMapping("/expenses")
    public List<OnlineExpenseResponse> expenses(@RequestParam(required = false) String month) {
        return shop.listExpenses(month);
    }

    @PostMapping("/expenses")
    @ResponseStatus(HttpStatus.CREATED)
    public OnlineExpenseResponse create(@Valid @RequestBody OnlineExpenseInput input) {
        return shop.createExpense(input);
    }

    @PatchMapping("/expenses/{id}")
    public OnlineExpenseResponse replace(@PathVariable String id, @Valid @RequestBody OnlineExpenseInput input) {
        return shop.replaceExpense(Ids.parse(id, "expense id"), input);
    }

    @DeleteMapping("/expenses/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        shop.deleteExpense(Ids.parse(id, "expense id"));
    }

    @PostMapping("/expenses/bulk-delete")
    public Map<String, Integer> bulkDelete(@Valid @RequestBody BulkDeleteRequest request) {
        return Map.of("deleted", shop.bulkDeleteExpenses(request.ids()));
    }
}
