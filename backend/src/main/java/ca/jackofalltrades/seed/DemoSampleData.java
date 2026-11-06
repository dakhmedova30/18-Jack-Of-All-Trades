package ca.jackofalltrades.seed;

import ca.jackofalltrades.channels.ChannelResponse;
import ca.jackofalltrades.channels.ChannelService;
import ca.jackofalltrades.common.security.BusinessPrincipal;
import ca.jackofalltrades.expenses.ExpenseInput;
import ca.jackofalltrades.expenses.ExpenseService;
import ca.jackofalltrades.items.ItemInput;
import ca.jackofalltrades.items.ItemRepository;
import ca.jackofalltrades.items.ItemService;
import ca.jackofalltrades.sales.SaleInput;
import ca.jackofalltrades.sales.SaleService;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Sample items, restocks, costs and sales for the demo account, so every page has something to
 * show. The data is fixed (no randomness) and dated relative to now: about six weeks back, plus a
 * restock, a cost and a few sales that always fall in the current UTC month, so the "this month"
 * views (Home, Sales, Expenses) are never empty. Everything goes through the normal services, so
 * stock and validation rules apply just as if the owner had typed it in.
 */
@Component
public class DemoSampleData {

    /** One product: start quantity before restocks and sales, price, and its tag. */
    private record Product(String name, int quantity, int unitPriceCents, String tag) {}

    /** Restocks {@code quantity} of {@code PRODUCTS[product]} at {@code unitCostCents} each. */
    private record Restock(int product, int quantity, int unitCostCents) {}

    /** A plain cost that doesn't touch stock, e.g. a market stall fee. */
    private record Cost(String description, int cents, String tag) {}

    /** {@code product} indexes into PRODUCTS. */
    private record Line(int product, int quantity) {}

    /** {@code channel} is one of ChannelService.STARTER_CHANNELS. */
    private record Sale(String channel, List<Line> lines) {}

    /** An entry dated {@code daysAgo} days before today, at {@code hour}:00 UTC. */
    private record Past<T>(int daysAgo, int hour, T entry) {}

    private static final List<Product> PRODUCTS = List.of(
            new Product("Floral Art Print (8x10)", 12, 1800, "prints"),
            new Product("Pressed Flower Bookmark", 20, 650, "bookmarks"),
            new Product("Botanical Greeting Card", 30, 500, "cards"),
            new Product("Floral Tote Bag", 4, 2400, "bags"),
            new Product("Gift Wrapping Sheet", 15, 400, "gift wrap"),
            new Product("Custom Pet Portrait", 4, 8500, "commissions"),
            new Product("Wildflower Sticker Pack", 18, 700, "stickers"),
            new Product("Linen Sketch Notebook", 8, 1600, "notebooks"));

    private static final List<Past<Restock>> PAST_RESTOCKS = List.of(
            past(40, 10, new Restock(0, 10, 600)),
            past(38, 10, new Restock(2, 20, 150)),
            past(35, 10, new Restock(1, 20, 200)),
            past(28, 10, new Restock(3, 4, 1100)),
            past(21, 10, new Restock(6, 15, 250)));

    private static final List<Past<Cost>> PAST_COSTS = List.of(
            past(41, 9, new Cost("Market stall fee", 4500, "market")),
            past(33, 9, new Cost("Packaging supplies", 1850, "supplies")),
            past(26, 9, new Cost("Studio rent", 25000, "rent")),
            past(14, 9, new Cost("Craft fair booth", 6000, "market")),
            past(5, 9, new Cost("Internet", 5500, "utilities")));

    private static final List<Past<Sale>> PAST_SALES = List.of(
            past(41, 11, sale("In person", line(0, 2), line(2, 3))),
            past(39, 19, sale("Online", line(1, 2))),
            past(37, 13, sale("In person", line(3, 1), line(2, 2))),
            past(34, 16, sale("Commission", line(5, 1))),
            past(32, 20, sale("Online", line(6, 2), line(1, 1))),
            past(30, 12, sale("In person", line(0, 1), line(4, 2))),
            past(27, 18, sale("Online", line(7, 1))),
            past(25, 14, sale("In person", line(2, 4), line(1, 2))),
            past(23, 15, sale("Misc", line(4, 3))),
            past(20, 21, sale("Online", line(0, 1), line(6, 1))),
            past(18, 11, sale("In person", line(3, 1), line(7, 1))),
            past(15, 17, sale("Commission", line(5, 1))),
            past(13, 19, sale("Online", line(2, 2), line(6, 2))),
            past(11, 13, sale("In person", line(0, 2))),
            past(8, 20, sale("Online", line(1, 3))),
            past(6, 12, sale("In person", line(3, 2), line(2, 2))),
            past(4, 18, sale("Online", line(7, 1), line(6, 1))));

    // Dated between the 1st of the current UTC month and now, so every "this month" view has a
    // restock, a cost and some sales to show, whatever day it is.
    private static final Restock THIS_MONTH_RESTOCK = new Restock(7, 6, 700);

    private static final Cost THIS_MONTH_COST = new Cost("Shipping labels", 2275, "supplies");

    private static final List<Sale> THIS_MONTH_SALES = List.of(
            sale("In person", line(0, 1), line(2, 2)),
            sale("Online", line(1, 2), line(6, 1)),
            sale("Commission", line(5, 1)));

    private final ItemRepository items;
    private final ItemService itemService;
    private final ExpenseService expenseService;
    private final SaleService saleService;
    private final ChannelService channelService;

    public DemoSampleData(ItemRepository items, ItemService itemService, ExpenseService expenseService,
            SaleService saleService, ChannelService channelService) {
        this.items = items;
        this.itemService = itemService;
        this.expenseService = expenseService;
        this.saleService = saleService;
        this.channelService = channelService;
    }

    /**
     * Adds the sample data if the business has no items yet, so data the owner already has (like
     * the live demo's) is never touched or duplicated. Returns whether anything was added.
     */
    @Transactional
    public boolean addIfEmpty(Integer businessId) {
        return addIfEmpty(businessId, Instant.now());
    }

    /** {@link #addIfEmpty(Integer)} as if it were {@code now}; for tests. */
    @Transactional
    public boolean addIfEmpty(Integer businessId, Instant now) {
        if (items.existsByBusinessId(businessId)) {
            return false;
        }
        // The services take the business from the security context, as for a logged-in request.
        SecurityContext previous = SecurityContextHolder.getContext();
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
                new BusinessPrincipal(businessId), null, List.of()));
        SecurityContextHolder.setContext(context);
        try {
            add(now);
        } finally {
            SecurityContextHolder.setContext(previous);
        }
        return true;
    }

    /** Items first, then restocks (adding stock), then sales (taking it), so stock never runs short. */
    private void add(Instant now) {
        List<Integer> productIds = new ArrayList<>();
        for (Product product : PRODUCTS) {
            productIds.add(itemService.create(new ItemInput(product.name(), product.quantity(),
                    product.unitPriceCents(), List.of(product.tag()), "", false)).id());
        }
        Instant monthStart = LocalDate.ofInstant(now, ZoneOffset.UTC).withDayOfMonth(1)
                .atStartOfDay(ZoneOffset.UTC).toInstant();

        for (Past<Restock> past : PAST_RESTOCKS) {
            recordRestock(past.entry(), daysAgo(now, past), productIds);
        }
        recordRestock(THIS_MONTH_RESTOCK, thisMonth(monthStart, now, 1, 3), productIds);
        for (Past<Cost> past : PAST_COSTS) {
            recordCost(past.entry(), daysAgo(now, past));
        }
        recordCost(THIS_MONTH_COST, thisMonth(monthStart, now, 2, 3));

        List<ChannelResponse> channels = channelService.list();
        for (Past<Sale> past : PAST_SALES) {
            recordSale(past.entry(), daysAgo(now, past), channels, productIds);
        }
        for (int i = 0; i < THIS_MONTH_SALES.size(); i++) {
            String soldAt = thisMonth(monthStart, now, i + 1, THIS_MONTH_SALES.size() + 1);
            recordSale(THIS_MONTH_SALES.get(i), soldAt, channels, productIds);
        }
    }

    private void recordRestock(Restock restock, String incurredAt, List<Integer> productIds) {
        expenseService.record(new ExpenseInput(incurredAt, "", List.of("supplier"),
                List.of(new ExpenseInput.Line(productIds.get(restock.product()), null, restock.quantity(),
                        restock.unitCostCents()))));
    }

    private void recordCost(Cost cost, String incurredAt) {
        expenseService.record(new ExpenseInput(incurredAt, "", List.of(cost.tag()),
                List.of(new ExpenseInput.Line(null, cost.description(), 1, cost.cents()))));
    }

    /** Tagged with its first product's tag, so the Analytics "by tag" charts have something to show. */
    private void recordSale(Sale sale, String soldAt, List<ChannelResponse> channels, List<Integer> productIds) {
        List<SaleInput.Line> lines = sale.lines().stream()
                .map(line -> new SaleInput.Line(productIds.get(line.product()), line.quantity()))
                .toList();
        String tag = PRODUCTS.get(sale.lines().getFirst().product()).tag();
        saleService.record(new SaleInput(soldAt, channelId(channels, sale.channel()), "", List.of(tag), lines));
    }

    /** The starter channel with this name, or the first channel if it was renamed or deleted. */
    private static Integer channelId(List<ChannelResponse> channels, String name) {
        return channels.stream()
                .filter(channel -> channel.name().equals(name))
                .findFirst()
                .or(() -> channels.stream().findFirst())
                .map(ChannelResponse::id)
                .orElseThrow(() -> new IllegalStateException("The demo business has no sales channels"));
    }

    /** The entry's date and hour, counted back from now's UTC date; never later than now. */
    private static String daysAgo(Instant now, Past<?> past) {
        Instant at = LocalDate.ofInstant(now, ZoneOffset.UTC).minusDays(past.daysAgo())
                .atTime(past.hour(), 0).toInstant(ZoneOffset.UTC);
        return iso(at.isAfter(now) ? now : at);
    }

    /** The {@code part}/{@code parts} point between the start of the month and now. */
    private static String thisMonth(Instant monthStart, Instant now, int part, int parts) {
        Duration sinceStart = Duration.between(monthStart, now);
        return iso(monthStart.plus(sinceStart.multipliedBy(part).dividedBy(parts)));
    }

    private static String iso(Instant instant) {
        return instant.atOffset(ZoneOffset.UTC).toString();
    }

    private static <T> Past<T> past(int daysAgo, int hour, T entry) {
        return new Past<>(daysAgo, hour, entry);
    }

    private static Sale sale(String channel, Line... lines) {
        return new Sale(channel, List.of(lines));
    }

    private static Line line(int product, int quantity) {
        return new Line(product, quantity);
    }
}
