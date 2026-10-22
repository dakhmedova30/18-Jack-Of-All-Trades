package ca.jackofalltrades.sales;

import ca.jackofalltrades.common.api.Ids;
import ca.jackofalltrades.common.api.Paginated;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Sales endpoints (contract §4). No {@code @Validated}, for the reason given on ItemController. */
@RestController
@RequestMapping("/api/sales")
public class SaleController {

    private final SaleService saleService;

    public SaleController(SaleService saleService) {
        this.saleService = saleService;
    }

    @GetMapping
    public Paginated<SaleResponse> list(
            @RequestParam(defaultValue = "1")
            @Min(value = 1, message = "Must be at least 1") int page,
            @RequestParam(defaultValue = "10")
            @Min(value = 1, message = "Must be at least 1")
            @Max(value = 100, message = "Must be at most 100") int pageSize,
            @RequestParam(required = false)
            @Size(max = 100, message = "Must be at most 100 characters") String search,
            @RequestParam(defaultValue = "soldAt")
            @Pattern(regexp = "id|soldAt|total|tags|channel",
                    message = "Must be one of id, soldAt, total, tags, channel") String sort,
            @RequestParam(defaultValue = "desc")
            @Pattern(regexp = "asc|desc", message = "Must be one of asc, desc") String order) {
        String trimmed = search == null ? null : search.strip();
        return saleService.list(trimmed == null || trimmed.isEmpty() ? null : trimmed, sort, order, page, pageSize);
    }

    @GetMapping("/{id}")
    public SaleResponse get(@PathVariable String id) {
        return saleService.get(Ids.parse(id, "sale id"));
    }
}
