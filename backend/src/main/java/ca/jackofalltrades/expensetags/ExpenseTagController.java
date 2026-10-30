package ca.jackofalltrades.expensetags;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Expense tags (contract §5.1): the business's list, oldest first, and adding one. */
@RestController
@RequestMapping("/api/expense-tags")
public class ExpenseTagController {

    private final ExpenseTagService expenseTagService;

    public ExpenseTagController(ExpenseTagService expenseTagService) {
        this.expenseTagService = expenseTagService;
    }

    @GetMapping
    public List<ExpenseTagResponse> list() {
        return expenseTagService.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ExpenseTagResponse create(@Valid @RequestBody ExpenseTagRequest request) {
        return expenseTagService.create(request);
    }

    /** Also renames the tag on the business's existing expenses, so history stays grouped. */
    @PutMapping("/{id}")
    public ExpenseTagResponse rename(@PathVariable int id, @Valid @RequestBody ExpenseTagRequest request) {
        return expenseTagService.rename(id, request);
    }

    /** Only removes the tag from the dropdown list; expenses already tagged with it keep the text. */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable int id) {
        expenseTagService.delete(id);
    }
}
