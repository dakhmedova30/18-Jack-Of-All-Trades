package ca.jackofalltrades.items;

import ca.jackofalltrades.auth.Business;
import ca.jackofalltrades.auth.BusinessRepository;
import ca.jackofalltrades.common.api.BadRequestException;
import ca.jackofalltrades.common.api.ConflictException;
import ca.jackofalltrades.common.api.NotFoundException;
import ca.jackofalltrades.common.api.Paginated;
import ca.jackofalltrades.common.security.CurrentBusiness;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashSet;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business rules for items (contract §3). The business id always comes from CurrentBusiness.
 * Writes lock the item rows they change (see ItemRepository), like sales do.
 */
@Service
public class ItemService {

    static final int BEST_SELLERS_LIMIT = 3;

    private final ItemRepository items;
    private final ItemQueries queries;
    private final CurrentBusiness currentBusiness;
    private final BusinessRepository businesses;

    public ItemService(
            ItemRepository items,
            ItemQueries queries,
            CurrentBusiness currentBusiness,
            BusinessRepository businesses) {
        this.businesses = businesses;
        this.items = items;
        this.queries = queries;
        this.currentBusiness = currentBusiness;
    }

    @Transactional(readOnly = true)
    public List<ItemTagCount> tagCounts() {
        return queries.tagCounts(currentBusiness.id());
    }

    /** Renames the tag on every item that has it; 404 if no item does. */
    @Transactional
    public ItemTagCount renameTag(String oldName, String newName) {
        int businessId = currentBusiness.id();
        if (queries.renameTag(businessId, oldName, newName) == 0) {
            throw new NotFoundException("Tag", oldName);
        }
        return queries.tagCounts(businessId).stream()
                .filter(tag -> tag.name().equals(newName))
                .findFirst()
                .orElseThrow();
    }

    /** Removes the tag from every item that has it; 404 if no item does. */
    @Transactional
    public void removeTag(String name) {
        if (queries.removeTag(currentBusiness.id(), name) == 0) {
            throw new NotFoundException("Tag", name);
        }
    }

    @Transactional(readOnly = true)
    public Paginated<ItemResponse> list(String search, String sort, String order, int page, int pageSize) {
        return queries.findPage(currentBusiness.id(), search, sort, order, page, pageSize);
    }

    @Transactional(readOnly = true)
    public ItemResponse get(int id) {
        return items.findByIdAndBusinessId(id, currentBusiness.id())
                .map(ItemResponse::from)
                .orElseThrow(() -> new NotFoundException("Item", id));
    }

    /** Stock value, plus this UTC month's best sellers and unsold in-stock items, as the demo and Analytics use. */
    @Transactional(readOnly = true)
    public InventoryInsights insights() {
        LocalDate firstOfMonth = LocalDate.now(ZoneOffset.UTC).withDayOfMonth(1);
        Instant start = firstOfMonth.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant end = firstOfMonth.plusMonths(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        Integer businessId = currentBusiness.id();
        String currency = businesses.findById(businessId)
                .map(Business::getCurrency)
                .orElseThrow(() -> new NotFoundException("Business", businessId));
        long[] totals = queries.stockTotals(businessId, currency);
        return new InventoryInsights(totals[0], totals[1], start, end,
                queries.bestSellers(businessId, start, end, BEST_SELLERS_LIMIT, currency),
                queries.notSelling(businessId, start, end));
    }

    @Transactional(readOnly = true)
    public LowStock lowStock(int limit) {
        // An item is "low stock" at or below the business's own threshold (Settings > Preferences).
        int threshold = businesses.findById(currentBusiness.id())
                .map(Business::getLowStockThreshold)
                .orElse(5);
        return queries.lowStock(currentBusiness.id(), threshold, limit);
    }

    @Transactional
    public ItemResponse create(ItemInput input) {
        Business business = businesses.findLockedById(currentBusiness.id())
                .orElseThrow(() -> new NotFoundException("Business", currentBusiness.id()));
        Item item = new Item(currentBusiness.id(), input.name(), input.quantity(), input.unitPriceCents(),
                input.currency() != null ? input.currency() : business.getCurrency(),
                input.tags(), input.note(), input.isPublic());
        item.setSize(input.width(), input.height(), input.sizeUnit());
        item.setAmountSold(input.amountSold());
        item.setActive(input.isActive());
        return ItemResponse.from(items.saveAndFlush(item));
    }

    /**
     * Changes only the fields sent. Locks the item first, so a quantity set here can't overwrite
     * the stock change of a sale saved at the same moment.
     */
    @Transactional
    public ItemResponse update(int id, ItemUpdate changes) {
        if (changes.isEmpty()) {
            throw new BadRequestException("Provide at least one field to update");
        }
        Item item = items.findLockedByIdAndBusinessId(id, currentBusiness.id())
                .orElseThrow(() -> new NotFoundException("Item", id));
        if (changes.name() != null) {
            item.setName(changes.name());
        }
        if (changes.quantity() != null) {
            item.setQuantity(changes.quantity());
        }
        if (changes.currency() != null) {
            item.setCurrency(changes.currency());
        }
        if (changes.unitPriceCents() != null) {
            item.setUnitPriceCents(changes.unitPriceCents());
        }
        if (changes.width() != null) {
            item.setSize(changes.width(), changes.height(), changes.sizeUnit());
        } else if (Boolean.TRUE.equals(changes.clearSize())) {
            item.setSize(null, null, null);
        }
        if (changes.amountSold() != null) {
            item.setAmountSold(changes.amountSold());
        }
        if (changes.isActive() != null) {
            item.setActive(changes.isActive());
        }
        if (changes.tags() != null) {
            item.setTags(changes.tags());
        }
        if (changes.note() != null) {
            item.setNote(changes.note());
        }
        if (changes.isPublic() != null) {
            item.setPublic(changes.isPublic());
        }
        return ItemResponse.from(items.saveAndFlush(item));
    }

    /** An item that sales or expenses use can't be deleted; it can be deactivated instead. */
    @Transactional
    public void delete(int id) {
        Item item = items.findLockedByIdAndBusinessId(id, currentBusiness.id())
                .orElseThrow(() -> new NotFoundException("Item", id));
        rejectIfInUse(List.of(item.getId()));
        items.delete(item);
    }

    /** Deletes those of {@code ids} that are this business's items; others are skipped, as in the demo. */
    @Transactional
    public int bulkDelete(List<Integer> ids) {
        List<Item> found = items.findLockedByIdInAndBusinessIdOrderByIdAsc(new LinkedHashSet<>(ids), currentBusiness.id());
        rejectIfInUse(found.stream().map(Item::getId).toList());
        found.forEach(items::delete);
        return found.size();
    }

    private void rejectIfInUse(List<Integer> ids) {
        List<String> inUse = queries.referencedNames(currentBusiness.id(), ids);
        if (!inUse.isEmpty()) {
            throw new ConflictException("Used by sales or expenses, so it can't be deleted: "
                    + String.join(", ", inUse) + ". Deactivate it instead.");
        }
    }

    /**
     * Shows or hides those of {@code ids} that are this business's items on its public profile;
     * others are skipped, like bulkDelete. The locked items are managed entities, so the change is
     * saved at commit, and updatedAt changes with it.
     */
    @Transactional
    public int bulkSetPublic(List<Integer> ids, boolean isPublic) {
        List<Item> found = items.findLockedByIdInAndBusinessIdOrderByIdAsc(new LinkedHashSet<>(ids), currentBusiness.id());
        found.forEach(item -> item.setPublic(isPublic));
        return found.size();
    }
}
