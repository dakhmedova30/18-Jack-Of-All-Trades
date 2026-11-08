package ca.jackofalltrades.sales;

import ca.jackofalltrades.channels.Channel;
import ca.jackofalltrades.channels.ChannelRepository;
import ca.jackofalltrades.auth.Business;
import ca.jackofalltrades.auth.BusinessRepository;
import ca.jackofalltrades.currency.CurrencyTotals;
import ca.jackofalltrades.discounts.DiscountCalculator;
import ca.jackofalltrades.discounts.DiscountResponse;
import ca.jackofalltrades.discounts.DiscountService;
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
    private final BusinessRepository businesses;
    private final CurrencyTotals currencyTotals;
    private final DiscountService discounts;
    private final MarketLookup markets;
    private final CommissionLookup commissions;

    public SaleService(SaleRepository sales, SaleQueries queries, ItemRepository items,
            ChannelRepository channels, CurrentBusiness currentBusiness, BusinessRepository businesses,
            CurrencyTotals currencyTotals, DiscountService discounts, MarketLookup markets,
            CommissionLookup commissions) {
        this.discounts = discounts;
        this.markets = markets;
        this.commissions = commissions;
        this.sales = sales;
        this.queries = queries;
        this.items = items;
        this.channels = channels;
        this.currentBusiness = currentBusiness;
        this.businesses = businesses;
        this.currencyTotals = currencyTotals;
    }

    @Transactional(readOnly = true)
    public Paginated<SaleResponse> list(SaleFilters filters, String sort, String order, int page, int pageSize) {
        String targetCurrency = accountCurrency();
        Paginated<SaleResponse> result = queries.findPage(currentBusiness.id(), filters, sort, order, page, pageSize);
        return new Paginated<>(result.data().stream()
                .map(sale -> displayedIn(sale, targetCurrency))
                .toList(), result.page(), result.pageSize(), result.total(), result.totalPages());
    }

    @Transactional(readOnly = true)
    public SaleResponse get(int id) {
        return sales.findByIdAndBusinessId(id, currentBusiness.id())
                .map(SaleResponse::from)
                .orElseThrow(() -> new NotFoundException("Sale", id));
    }

    /** "This month at a glance": the current UTC calendar month, as the demo and Analytics use. */
    @Transactional(readOnly = true)
    public SalesMonthSummary monthSummary() {
        LocalDate firstOfMonth = LocalDate.now(ZoneOffset.UTC).withDayOfMonth(1);
        Instant start = firstOfMonth.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant end = firstOfMonth.plusMonths(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        return queries.periodSummary(currentBusiness.id(), start, end, accountCurrency());
    }

    @Transactional
    public SaleResponse record(SaleInput input) {
        Integer businessId = currentBusiness.id();
        Business business = lockBusiness(businessId);
        Channel channel = findChannel(businessId, input.channelId());
        Map<Integer, Item> locked = lockItems(businessId, itemIds(input.items()));
        Sale sale = new Sale(businessId);
        apply(sale, input, channel, locked, business.getCurrency());
        return SaleResponse.from(sales.saveAndFlush(sale));
    }

    /** PATCH: puts the old lines' stock back, then applies the new input as if recording it. */
    @Transactional
    public SaleResponse replace(int id, SaleInput input) {
        Integer businessId = currentBusiness.id();
        Business business = lockBusiness(businessId);
        Sale sale = sales.findLockedByIdAndBusinessId(id, businessId)
                .orElseThrow(() -> new NotFoundException("Sale", id));
        Set<Integer> touched = new LinkedHashSet<>(lineItemIds(List.of(sale)));
        touched.addAll(itemIds(input.items()));
        Map<Integer, Item> locked = lockItems(businessId, touched);

        restoreStock(sale, locked);
        Channel channel = findChannel(businessId, input.channelId());
        apply(sale, input, channel, locked, business.getCurrency());
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
    private void apply(Sale sale, SaleInput input, Channel channel, Map<Integer, Item> locked, String currency) {
        List<SaleLine> lines = new ArrayList<>();
        String saleCurrency = input.currency() != null ? input.currency()
                : sale.getCurrency() != null ? sale.getCurrency() : currency;
        boolean repricing = sale.getCurrency() != null && !sale.getCurrency().equals(saleCurrency);
        Map<Integer, Integer> existingPrices = repricing ? Map.of() : sale.getLines().stream()
                .filter(line -> line.getItemId() != null && "ITEM".equals(line.getKind()) && !line.isFree()
                        && !line.isTrade())
                .collect(Collectors.toMap(SaleLine::getItemId, SaleLine::getUnitPriceCents, (first, ignored) -> first));
        if (input.items().isEmpty() && input.tipCents() == null) {
            throw new BadRequestException("A sale needs at least one item or a tip");
        }
        if (input.marketId() != null && input.commissionId() != null) {
            throw new BadRequestException("A sale cannot belong to both a market and a commission");
        }
        if (input.marketId() != null && !markets.exists(sale.getBusinessId(), input.marketId())) {
            throw new BadRequestException("Market " + input.marketId() + " does not exist");
        }
        if (input.commissionId() != null && !commissions.exists(sale.getBusinessId(), input.commissionId())) {
            throw new BadRequestException("Commission " + input.commissionId() + " does not exist");
        }
        List<Integer> eligiblePrices = new ArrayList<>();
        List<Item> soldItems = new ArrayList<>();
        for (SaleInput.Line line : input.items()) {
            Item item = locked.get(line.itemId());
            if (item == null) {
                throw new BadRequestException("Item " + line.itemId() + " does not exist");
            }
            if (!item.isActive() && !existingPrices.containsKey(item.getId())) {
                throw new BadRequestException("\"" + item.getName() + "\" is inactive and can't be sold");
            }
            if (item.getQuantity() < line.quantity()) {
                throw new BadRequestException("Not enough stock for \"" + item.getName() + "\" (have "
                        + item.getQuantity() + ", need " + line.quantity() + ")");
            }
            item.adjustQuantity(-line.quantity());
            item.adjustAmountSold(line.quantity());
            boolean free = Boolean.TRUE.equals(line.isFree());
            boolean trade = Boolean.TRUE.equals(line.isTrade());
            int unitPriceCents;
            if (free || trade) {
                unitPriceCents = 0;
            } else if (line.unitPriceCents() != null) {
                unitPriceCents = line.unitPriceCents();
            } else if (existingPrices.containsKey(item.getId())) {
                unitPriceCents = existingPrices.get(item.getId());
            } else if (item.getCurrency().equals(saleCurrency)) {
                unitPriceCents = item.getUnitPriceCents();
            } else {
                unitPriceCents = convertedUnitPrice(item.getUnitPriceCents(), item.getCurrency(), saleCurrency);
            }
            int total = multiplyCents(unitPriceCents, line.quantity());
            lines.add(new SaleLine(item.getId(), item.getName(), line.quantity(), unitPriceCents, total, free,
                    trade));
            if (!free && !trade) {
                for (int i = 0; i < line.quantity(); i++) {
                    eligiblePrices.add(unitPriceCents);
                    soldItems.add(item);
                }
            }
        }
        for (Integer discountId : input.discountIds()) {
            DiscountResponse discount = discounts.find(sale.getBusinessId(), discountId)
                    .orElseThrow(() -> new BadRequestException("Discount " + discountId + " does not exist"));
            List<Integer> prices = new ArrayList<>();
            for (int i = 0; i < soldItems.size(); i++) {
                if (discount.appliesTo() == null || soldItems.get(i).getTags().contains(discount.appliesTo())) {
                    prices.add(eligiblePrices.get(i));
                }
            }
            long amount = DiscountCalculator.amountOffCents(discounts.toRule(discount, saleCurrency), prices);
            if (amount <= 0) {
                continue;
            }
            int signed = Math.toIntExact(discount.isCharge() ? amount : -amount);
            lines.add(SaleLine.adjustment(discount.isCharge() ? "CHARGE" : "DISCOUNT", discount.name(), signed,
                    discount.id()));
        }
        if (input.tipCents() != null) {
            lines.add(SaleLine.adjustment("TIP", "Tip", input.tipCents(), null));
        }
        String description = input.description().isEmpty() ? describe(lines) : input.description();
        sale.replace(OffsetDateTime.parse(input.soldAt()).toInstant(), channel, description, input.tags(), lines,
                saleCurrency, input.marketId(), input.commissionId());
    }

    private Business lockBusiness(Integer businessId) {
        return businesses.findLockedById(businessId)
                .orElseThrow(() -> new NotFoundException("Business", businessId));
    }

    private String accountCurrency() {
        return businesses.findById(currentBusiness.id())
                .map(Business::getCurrency)
                .orElseThrow(() -> new NotFoundException("Business", currentBusiness.id()));
    }

    private SaleResponse displayedIn(SaleResponse sale, String targetCurrency) {
        long converted = currencyTotals.convertCents(sale.totalCents(), sale.originalCurrency(), targetCurrency);
        return sale.displayedIn(targetCurrency, converted);
    }

    /** Puts each line's quantity back; lines whose item was deleted (itemId null) are skipped. */
    private static void restoreStock(Sale sale, Map<Integer, Item> locked) {
        for (SaleLine line : sale.getLines()) {
            Item item = line.getItemId() == null ? null : locked.get(line.getItemId());
            if (item != null) {
                try {
                    item.adjustQuantity(line.getQuantity());
                    item.adjustAmountSold(-line.getQuantity());
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

    private int convertedUnitPrice(int cents, String sourceCurrency, String targetCurrency) {
        try {
            return Math.toIntExact(currencyTotals.convertCents(cents, sourceCurrency, targetCurrency));
        } catch (ArithmeticException e) {
            throw new BadRequestException("Converted price is out of range");
        }
    }

    /** The default description, as the demo's describeLines.ts: "Flower Print x 2, Keychain x 1". */
    static String describe(List<SaleLine> lines) {
        String text = lines.stream()
                .filter(line -> "ITEM".equals(line.getKind()))
                .map(line -> line.getItemName() + " x " + line.getQuantity())
                .collect(Collectors.joining(", "));
        if (text.isEmpty()) {
            return "Tip";
        }
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
