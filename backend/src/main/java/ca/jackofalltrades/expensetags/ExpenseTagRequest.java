package ca.jackofalltrades.expensetags;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * {@code POST /api/expense-tags} body (contract §5.1). Same 30-character limit as any tag, since
 * the name is what gets stored in an expense's tags. The name is trimmed before validation.
 */
public record ExpenseTagRequest(
        @NotBlank(message = "Name is required")
        @Size(max = 30, message = "Name must be at most 30 characters")
        String name) {

    public ExpenseTagRequest {
        name = name == null ? null : name.strip();
    }
}
