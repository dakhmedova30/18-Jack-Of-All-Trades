package ca.jackofalltrades.sales;

import ca.jackofalltrades.channels.Channel;
import ca.jackofalltrades.channels.ChannelRepository;
import ca.jackofalltrades.common.api.BadRequestException;
import ca.jackofalltrades.common.api.NotFoundException;
import ca.jackofalltrades.common.api.Paginated;
import ca.jackofalltrades.common.security.CurrentBusiness;
import ca.jackofalltrades.items.Item;
import ca.jackofalltrades.items.ItemRepository;
import java.time.OffsetDateTime;
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
 * Business rules for sales (contract §4). The business id always comes from CurrentBusiness.
 *
 * <p>Recording, editing or deleting a sale keeps stock in sync, so each write is one transaction.
 * Writes lock the sale row first, then the items it touches in id order (see SaleRepository), so
 * two requests selling the last unit can't both succeed, and a sale can't be deleted twice.
 */
@Service
public class SaleService {

    /** The demo's describeLines.ts limit, which is also the description field's limit. */
    static final int DESCRIPTION_MAX = 200;

    private final SaleRepository sales;
    private final SaleQueries queries;
    private final ItemRepository items;
    private final ChannelRepository channels;
    private final CurrentBusiness currentBusiness;

    public SaleService(SaleRepository sales, SaleQueries queries, ItemRepository items,
            ChannelRepository channels, CurrentBusiness currentBusiness) {
        this.sales = sales;
        this.queries = queries;
        this.items = items;
        this.channels = channels;
        this.currentBusiness = currentBusiness;
    }

    @Transactional(readOnly = true)
    public Paginated<SaleResponse> list(String search, String sort, String order, int page, int pageSize) {
        return queries.findPage(currentBusiness.id(), search, sort, order, page, pageSize);
    }

    @Transactional(readOnly = true)
    public SaleResponse get(int id) {
        return sales.findByIdAndBusinessId(id, currentBusiness.id())
                .map(SaleResponse::from)
                .orElseThrow(() -> new NotFoundException("Sale", id));
    }

    @Transactional
    public SaleResponse record(SaleInput input) {
        Integer businessId = currentBusiness.id();
        Channel channel = findChannel(businessId, input.channelId());
        Map<Integer, Item> locked = lockItems(businessId, itemIds(input.items()));
        Sale sale = new Sale(businessId);
        apply(sale, input, channel, locked);
        return SaleResponse.from(sales.saveAndFlush(sale));
    }

    /** PATCH: puts the old lines' stock back, then applies the new input as if recording it. */
    @Transactional
    public SaleResponse replace(int id, SaleInput input) {
        Integer businessId = currentBusiness.id();
        Sale sale = sales.findLockedByIdAndBusinessId(id, businessId)
                .orElseThrow(() -> new NotFoundException("Sale", id));
        Set<Integer> touched = new LinkedHashSet<>(lineItemIds(List.of(sale)));
        touched.addAll(itemIds(input.items()));
        Map<Integer, Item> locked = lockItems(businessId, touched);

        restoreStock(sale, locked);
        Channel channel = findChannel(businessId, input.channelId());
        apply(sale, input, channel, locked);
        return SaleResponse.from(sales.saveAndFlush(sale));
    }

    @Transactional
    public void delete(int id) {
        Integer businessId = currentBusiness.id();
        Sale sale = sales.findLockedByIdAndBusinessId(id, businessId)
                .orElseThrow(() -> new NotFoundException("Sale", id));
        Map<Integer, Item> locked = lockItems(businessId, lineItemIds(List.of(sale)));
        restoreStock(sale, locked);
        sales.delete(sale);
    }

    /** Deletes those of {@code ids} that are this business's sales; others are skipped, as in the demo. */
    @Transactional
    public int bulkDelete(List<Integer> ids) {
        Integer businessId = currentBusiness.id();
        List<Sale> found = sales.findLockedByIdInAndBusinessIdOrderByIdAsc(new LinkedHashSet<>(ids), businessId);
        Map<Integer, Item> locked = lockItems(businessId, lineItemIds(found));
        for (Sale sale : found) {
            restoreStock(sale, locked);
            sales.delete(sale);
        }
        return found.size();
    }

    private Channel findChannel(Integer businessId, Integer channelId) {
        return channels.findByIdAndBusinessId(channelId, businessId)
                .orElseThrow(() -> new BadRequestException("Channel " + channelId + " does not exist"));
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
     * Sells each input line in order: checks the item exists and has enough stock, takes the
     * stock, and copies the item's current name and price into the line. A later line for the
     * same item sees the stock left by the earlier one. Any failure rolls back the transaction.
     */
    private void apply(Sale sale, SaleInput input, Channel channel, Map<Integer, Item> locked) {
        List<SaleLine> lines = new ArrayList<>();
        for (SaleInput.Line line : input.items()) {
            Item item = locked.get(line.itemId());
            if (item == null) {
                throw new BadRequestException("Item " + line.itemId() + " does not exist");
            }
            if (item.getQuantity() < line.quantity()) {
                throw new BadRequestException("Not enough stock for \"" + item.getName() + "\" (have "
                        + item.getQuantity() + ", need " + line.quantity() + ")");
            }
            item.adjustQuantity(-line.quantity());
            int total = multiplyCents(item.getUnitPriceCents(), line.quantity());
            lines.add(new SaleLine(item.getId(), item.getName(), line.quantity(), item.getUnitPriceCents(), total));
        }
        String description = input.description().isEmpty() ? describe(lines) : input.description();
        sale.replace(OffsetDateTime.parse(input.soldAt()).toInstant(), channel, description, input.tags(), lines);
    }

    /** Puts each line's quantity back; lines whose item was deleted (itemId null) are skipped. */
    private static void restoreStock(Sale sale, Map<Integer, Item> locked) {
        for (SaleLine line : sale.getLines()) {
            Item item = line.getItemId() == null ? null : locked.get(line.getItemId());
            if (item != null) {
                try {
                    item.adjustQuantity(line.getQuantity());
                } catch (ArithmeticException e) {
                    throw new BadRequestException("Number is out of range");
                }
            }
        }
    }

    /** {@code price × quantity}; the demo gets the same 400 from Postgres when it doesn't fit. */
    private static int multiplyCents(int unitPriceCents, int quantity) {
        try {
            return Math.multiplyExact(unitPriceCents, quantity);
        } catch (ArithmeticException e) {
            throw new BadRequestException("Number is out of range");
        }
    }

    /** The default description, as the demo's describeLines.ts: "Flower Print x 2, Keychain x 1". */
    static String describe(List<SaleLine> lines) {
        String text = lines.stream()
                .map(line -> line.getItemName() + " x " + line.getQuantity())
                .collect(Collectors.joining(", "));
        return text.length() <= DESCRIPTION_MAX ? text : text.substring(0, DESCRIPTION_MAX - 1) + "…";
    }

    private static Set<Integer> itemIds(List<SaleInput.Line> lines) {
        return lines.stream().map(SaleInput.Line::itemId).collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private static Set<Integer> lineItemIds(List<Sale> sales) {
        return sales.stream()
                .flatMap(sale -> sale.getLines().stream())
                .map(SaleLine::getItemId)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }
}
