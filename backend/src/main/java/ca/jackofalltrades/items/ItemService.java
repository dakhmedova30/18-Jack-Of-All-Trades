package ca.jackofalltrades.items;

import ca.jackofalltrades.common.api.BadRequestException;
import ca.jackofalltrades.common.api.NotFoundException;
import ca.jackofalltrades.common.api.Paginated;
import ca.jackofalltrades.common.security.CurrentBusiness;
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

    private final ItemRepository items;
    private final ItemQueries queries;
    private final CurrentBusiness currentBusiness;

    public ItemService(ItemRepository items, ItemQueries queries, CurrentBusiness currentBusiness) {
        this.items = items;
        this.queries = queries;
        this.currentBusiness = currentBusiness;
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

    @Transactional
    public ItemResponse create(ItemInput input) {
        Item item = new Item(currentBusiness.id(), input.name(), input.quantity(), input.unitPriceCents(),
                input.tags(), input.note());
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
        if (changes.unitPriceCents() != null) {
            item.setUnitPriceCents(changes.unitPriceCents());
        }
        if (changes.tags() != null) {
            item.setTags(changes.tags());
        }
        if (changes.note() != null) {
            item.setNote(changes.note());
        }
        return ItemResponse.from(items.saveAndFlush(item));
    }

    /** Past sales keep the item's name; the database sets their lines' item_id to NULL. */
    @Transactional
    public void delete(int id) {
        Item item = items.findLockedByIdAndBusinessId(id, currentBusiness.id())
                .orElseThrow(() -> new NotFoundException("Item", id));
        items.delete(item);
    }

    /** Deletes those of {@code ids} that are this business's items; others are skipped, as in the demo. */
    @Transactional
    public int bulkDelete(List<Integer> ids) {
        List<Item> found = items.findLockedByIdInAndBusinessIdOrderByIdAsc(new LinkedHashSet<>(ids), currentBusiness.id());
        found.forEach(items::delete);
        return found.size();
    }
}
