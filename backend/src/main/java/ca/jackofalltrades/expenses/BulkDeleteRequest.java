package ca.jackofalltrades.expenses;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;

/** {@code POST /api/expenses/bulk-delete} body (contract §5): 1–100 ids. */
public record BulkDeleteRequest(
        @NotNull(message = "Select at least one expense")
        @Size(min = 1, message = "Select at least one expense")
        @Size(max = 100, message = "At most 100 expenses")
        List<@NotNull(message = "Required") @Positive(message = "Must be a positive number") Integer> ids) {}
