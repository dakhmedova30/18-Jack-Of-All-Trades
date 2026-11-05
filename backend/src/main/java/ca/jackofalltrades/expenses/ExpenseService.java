package ca.jackofalltrades.expenses;

import ca.jackofalltrades.common.api.BadRequestException;
import ca.jackofalltrades.common.api.NotFoundException;
import ca.jackofalltrades.common.api.Paginated;
import ca.jackofalltrades.common.security.CurrentBusiness;
import ca.jackofalltrades.items.Item;
import ca.jackofalltrades.items.ItemRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business rules for expenses (contract §5). The business id always comes from CurrentBusiness.
 *
 * <p>A line that names an item restocks it: recording adds the quantity to stock, and editing
 * or deleting takes it back out first, the mirror image of SaleService. Each write is one
 * transaction, and locks the expense row first, then the items it touches in id order (see
 * ExpenseRepository), so an expense can't be undone twice and writes can't deadlock.
 */
@Service
public class ExpenseService {

    /** The demo's describeLines.ts limit, which is also the description field's limit. */
    static final int DESCRIPTION_MAX = 200;

    static final int TOP_RESTOCK_ITEMS = 5;

    private final ExpenseRepository expenses;
    private final ExpenseQueries queries;
    private final ItemRepository items;
    private final CurrentBusiness currentBusiness;

    public ExpenseService(ExpenseRepository expenses, ExpenseQueries queries, ItemRepository items,
            CurrentBusiness currentBusiness) {
        this.expenses = expenses;
        this.queries = queries;
        this.items = items;
        this.currentBusiness = currentBusiness;
    }

    @Transactional(readOnly = true)
    public Paginated<ExpenseResponse> list(String search, String sort, String order, int page, int pageSize) {
        return queries.findPage(currentBusiness.id(), search, sort, order, page, pageSize);
    }

    @Transactional(readOnly = true)
    public ExpenseResponse get(int id) {
        return expenses.findByIdAndBusinessId(id, currentBusiness.id())
                .map(ExpenseResponse::from)
                .orElseThrow(() -> new NotFoundException("Expense", id));
    }

    /** "Where the money goes": the current UTC calendar month, as the demo and Analytics use. */
    @Transactional(readOnly = true)
    public ExpenseMonthBreakdown monthBreakdown() {
        LocalDate firstOfMonth = LocalDate.now(ZoneOffset.UTC).withDayOfMonth(1);
        Instant start = firstOfMonth.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant end = firstOfMonth.plusMonths(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        return queries.periodBreakdown(currentBusiness.id(), start, end, TOP_RESTOCK_ITEMS);
    }

    @Transactional
    public ExpenseResponse record(ExpenseInput input) {
        Integer businessId = currentBusiness.id();
        Map<Integer, Item> locked = lockItems(businessId, itemIds(input.items()));
        Expense expense = new Expense(businessId);
        apply(expense, input, locked);
        return ExpenseResponse.from(expenses.saveAndFlush(expense));
    }

    /** PATCH: takes the old restocks back out of stock, then applies the new input as if recording it. */
    @Transactional
    public ExpenseResponse replace(int id, ExpenseInput input) {
        Integer businessId = currentBusiness.id();
        Expense expense = expenses.findLockedByIdAndBusinessId(id, businessId)
                .orElseThrow(() -> new NotFoundException("Expense", id));
        Set<Integer> touched = new LinkedHashSet<>(lineItemIds(List.of(expense)));
        touched.addAll(itemIds(input.items()));
        Map<Integer, Item> locked = lockItems(businessId, touched);

        undoRestocks(expense, locked);
        apply(expense, input, locked);
        return ExpenseResponse.from(expenses.saveAndFlush(expense));
    }

    @Transactional
    public void delete(int id) {
        Integer businessId = currentBusiness.id();
        Expense expense = expenses.findLockedByIdAndBusinessId(id, businessId)
                .orElseThrow(() -> new NotFoundException("Expense", id));
        Map<Integer, Item> locked = lockItems(businessId, lineItemIds(List.of(expense)));
        undoRestocks(expense, locked);
        expenses.delete(expense);
    }

    /**
     * Deletes those of {@code ids} that are this business's expenses; others are skipped, as in
     * the demo. If any one can't be undone, nothing is deleted.
     */
    @Transactional
    public int bulkDelete(List<Integer> ids) {
        Integer businessId = currentBusiness.id();
        List<Expense> found = expenses.findLockedByIdInAndBusinessIdOrderByIdAsc(new LinkedHashSet<>(ids), businessId);
        Map<Integer, Item> locked = lockItems(businessId, lineItemIds(found));
        for (Expense expense : found) {
            undoRestocks(expense, locked);
            expenses.delete(expense);
        }
        return found.size();
    }

    /** Locks the business's items among {@code ids}, in id order. Ids that aren't theirs are simply absent. */
    private Map<Integer, Item> lockItems(Integer businessId, Collection<Integer> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        return items.findLockedByIdInAndBusinessIdOrderByIdAsc(ids, businessId).stream()
                .collect(Collectors.toMap(Item::getId, Function.identity()));
    }

    /**
     * Records each input line in order. A restock line checks the item exists, adds the quantity
     * to its stock and copies its current name; a plain-cost line uses its description as the
     * name and doesn't touch stock. Any failure rolls back the transaction.
     */
    private void apply(Expense expense, ExpenseInput input, Map<Integer, Item> locked) {
        List<ExpenseLine> lines = new ArrayList<>();
        for (ExpenseInput.Line line : input.items()) {
            int total = multiplyCents(line.unitCostCents(), line.quantity());
            if (line.itemId() == null) {
                lines.add(new ExpenseLine(null, line.description(), line.quantity(), line.unitCostCents(), total));
                continue;
            }
            Item item = locked.get(line.itemId());
            if (item == null) {
                throw new BadRequestException("Item " + line.itemId() + " does not exist");
            }
            adjustStock(item, line.quantity());
            lines.add(new ExpenseLine(item.getId(), item.getName(), line.quantity(), line.unitCostCents(), total));
        }
        String description = input.description().isEmpty() ? describe(lines) : input.description();
        expense.replace(OffsetDateTime.parse(input.incurredAt()).toInstant(), description, input.tags(), lines);
    }

    /**
     * Takes each restock back out of stock, as the demo's undoLines. Lines whose item was deleted
     * (itemId null) are skipped. If the restocked units have since been sold, the undo would take
     * stock below zero, so the whole request is rejected.
     */
    private static void undoRestocks(Expense expense, Map<Integer, Item> locked) {
        for (ExpenseLine line : expense.getLines()) {
            Item item = line.getItemId() == null ? null : locked.get(line.getItemId());
            if (item == null) {
                continue;
            }
            if (item.getQuantity() < line.getQuantity()) {
                throw new BadRequestException("Can't undo the restock of \"" + item.getName() + "\": only "
                        + item.getQuantity() + " in stock, need to remove " + line.getQuantity()
                        + " (some may have already been sold)");
            }
            adjustStock(item, -line.getQuantity());
        }
    }

    private static void adjustStock(Item item, int delta) {
        try {
            item.adjustQuantity(delta);
        } catch (ArithmeticException e) {
            throw new BadRequestException("Number is out of range");
        }
    }

    /** {@code cost × quantity}; the demo gets the same 400 from Postgres when it doesn't fit. */
    private static int multiplyCents(int unitCostCents, int quantity) {
        try {
            return Math.multiplyExact(unitCostCents, quantity);
        } catch (ArithmeticException e) {
            throw new BadRequestException("Number is out of range");
        }
    }

    /** The default description, as the demo's describeLines.ts: "Flower Print x 200, Shipping x 1". */
    static String describe(List<ExpenseLine> lines) {
        String text = lines.stream()
                .map(line -> line.getItemName() + " x " + line.getQuantity())
                .collect(Collectors.joining(", "));
        return text.length() <= DESCRIPTION_MAX ? text : text.substring(0, DESCRIPTION_MAX - 1) + "…";
    }

    private static Set<Integer> itemIds(List<ExpenseInput.Line> lines) {
        return lines.stream()
                .map(ExpenseInput.Line::itemId)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private static Set<Integer> lineItemIds(List<Expense> expenses) {
        return expenses.stream()
                .flatMap(expense -> expense.getLines().stream())
                .map(ExpenseLine::getItemId)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }
}
