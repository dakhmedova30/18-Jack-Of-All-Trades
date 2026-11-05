package ca.jackofalltrades.sales;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;

/** {@code POST /api/sales/bulk-delete} body (contract §4): 1–100 ids. */
public record BulkDeleteRequest(
        @NotNull(message = "Select at least one sale")
        @Size(min = 1, message = "Select at least one sale")
        @Size(max = 100, message = "At most 100 sales")
        List<@NotNull(message = "Required") @Positive(message = "Must be a positive number") Integer> ids) {}
