package ca.jackofalltrades.items;

import ca.jackofalltrades.common.api.NotFoundException;
import ca.jackofalltrades.common.api.Paginated;
import ca.jackofalltrades.common.security.CurrentBusiness;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Business rules for items. The business id always comes from CurrentBusiness. */
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
}
