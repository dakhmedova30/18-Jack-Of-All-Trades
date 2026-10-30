package ca.jackofalltrades.notifications;

import ca.jackofalltrades.auth.Business;
import ca.jackofalltrades.auth.BusinessRepository;
import ca.jackofalltrades.common.security.CurrentBusiness;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Works out which alerts apply to the logged-in business right now, from the settings it chose
 * and its own data. Nothing is stored per alert: they come and go as the data changes.
 */
@Service
public class NotificationService {

    /** How many item names an alert lists before "+ N more". */
    private static final int NAMES_SHOWN = 3;
    /** A new device's login stays an alert for this long. */
    private static final int NEW_DEVICE_DAYS = 7;
    private static final int MAX_USER_AGENT = 300;

    private final JdbcClient jdbcClient;
    private final BusinessRepository businesses;
    private final CurrentBusiness currentBusiness;

    public NotificationService(JdbcClient jdbcClient, BusinessRepository businesses, CurrentBusiness currentBusiness) {
        this.jdbcClient = jdbcClient;
        this.businesses = businesses;
        this.currentBusiness = currentBusiness;
    }

    @Transactional(readOnly = true)
    public NotificationSettings settings() {
        return settingsOf(currentBusiness.id());
    }

    @Transactional
    public NotificationSettings saveSettings(NotificationSettings settings) {
        jdbcClient.sql("""
                        INSERT INTO notification_settings (business_id, low_stock, out_of_stock, new_device,
                                                           no_sales, no_sales_days, expense_spike, expense_spike_percent)
                        VALUES (:businessId, :lowStock, :outOfStock, :newDevice,
                                :noSales, :noSalesDays, :expenseSpike, :expenseSpikePercent)
                        ON CONFLICT (business_id) DO UPDATE SET
                            low_stock = EXCLUDED.low_stock, out_of_stock = EXCLUDED.out_of_stock,
                            new_device = EXCLUDED.new_device, no_sales = EXCLUDED.no_sales,
                            no_sales_days = EXCLUDED.no_sales_days, expense_spike = EXCLUDED.expense_spike,
                            expense_spike_percent = EXCLUDED.expense_spike_percent
                        """)
                .param("businessId", currentBusiness.id())
                .param("lowStock", settings.lowStock())
                .param("outOfStock", settings.outOfStock())
                .param("newDevice", settings.newDevice())
                .param("noSales", settings.noSales())
                .param("noSalesDays", settings.noSalesDays())
                .param("expenseSpike", settings.expenseSpike())
                .param("expenseSpikePercent", settings.expenseSpikePercent())
                .update();
        return settings;
    }

    /** The alerts that apply now. {@code userAgent} is this browser, which never gets a "new device" alert about itself. */
    @Transactional(readOnly = true)
    public List<NotificationAlert> alerts(String userAgent) {
        int businessId = currentBusiness.id();
        NotificationSettings settings = settingsOf(businessId);
        Business business = businesses.findById(businessId).orElseThrow();
        List<NotificationAlert> alerts = new ArrayList<>();

        if (settings.lowStock() || settings.outOfStock()) {
            stockAlerts(businessId, business.getLowStockThreshold(), settings, alerts);
        }
        if (settings.noSales()) {
            noSalesAlert(businessId, business.getCreatedAt(), settings.noSalesDays(), alerts);
        }
        if (settings.expenseSpike()) {
            expenseSpikeAlert(businessId, settings.expenseSpikePercent(), alerts);
        }
        if (settings.newDevice()) {
            newDeviceAlerts(businessId, clip(userAgent), alerts);
        }
        return alerts;
    }

    // ---------------------------------------------------------------- stock

    private record StockItem(int id, String name, int quantity) {}

    private void stockAlerts(int businessId, int threshold, NotificationSettings settings, List<NotificationAlert> out) {
        List<StockItem> items = jdbcClient.sql("""
                        SELECT id, name, quantity FROM items
                        WHERE business_id = :businessId AND quantity <= :threshold
                        ORDER BY quantity, name, id
                        """)
                .param("businessId", businessId)
                .param("threshold", threshold)
                .query((rs, rowNum) -> new StockItem(rs.getInt("id"), rs.getString("name"), rs.getInt("quantity")))
                .list();

        // Out of stock is its own alert, so low stock only counts items that still have some.
        List<StockItem> empty = items.stream().filter(item -> item.quantity() == 0).toList();
        List<StockItem> low = items.stream().filter(item -> item.quantity() > 0).toList();

        if (settings.outOfStock() && !empty.isEmpty()) {
            out.add(new NotificationAlert(
                    "out-of-stock",
                    fingerprint(empty),
                    "Out of stock",
                    plural(empty.size(), "item has", "items have") + " none left: "
                            + names(empty, false),
                    "/inventory",
                    null,
                    null));
        }
        if (settings.lowStock() && !low.isEmpty()) {
            out.add(new NotificationAlert(
                    "low-stock",
                    fingerprint(low),
                    "Low stock",
                    plural(low.size(), "item is", "items are") + " down to " + threshold + " or fewer: "
                            + names(low, true),
                    "/inventory",
                    null,
                    null));
        }
    }

    private static String names(List<StockItem> items, boolean withQuantity) {
        String shown = items.stream()
                .limit(NAMES_SHOWN)
                .map(item -> withQuantity ? item.name() + " (" + item.quantity() + ")" : item.name())
                .collect(Collectors.joining(", "));
        int more = items.size() - NAMES_SHOWN;
        return more > 0 ? shown + ", +" + more + " more" : shown;
    }

    /** Changes whenever the set of items, or any of their quantities, does. */
    private static String fingerprint(List<StockItem> items) {
        return Integer.toHexString(items.stream().map(item -> item.id() + ":" + item.quantity()).toList().hashCode());
    }

    // ---------------------------------------------------------------- sales

    private void noSalesAlert(int businessId, Instant accountCreatedAt, int days, List<NotificationAlert> out) {
        Instant lastSale = jdbcClient.sql("SELECT MAX(sold_at) FROM sales WHERE business_id = :businessId")
                .param("businessId", businessId)
                .query((rs, rowNum) -> {
                    OffsetDateTime at = rs.getObject(1, OffsetDateTime.class);
                    return at == null ? null : at.toInstant();
                })
                .single();
        Instant now = Instant.now();
        Instant cutoff = now.minus(Duration.ofDays(days));

        if (lastSale == null) {
            // Never sold anything: only nag once the account is old enough for it to matter.
            if (accountCreatedAt != null && accountCreatedAt.isBefore(cutoff)) {
                out.add(new NotificationAlert(
                        "no-sales", "none", "No sales yet",
                        "You haven't recorded any sales yet.", "/sales", null, null));
            }
            return;
        }
        if (lastSale.isBefore(cutoff)) {
            long daysAgo = ChronoUnit.DAYS.between(lastSale, now);
            out.add(new NotificationAlert(
                    "no-sales",
                    lastSale.truncatedTo(ChronoUnit.DAYS).toString(),
                    "No recent sales",
                    "No sales recorded in the last " + plural(days, "day", "days")
                            + ". The last one was " + plural((int) daysAgo, "day", "days") + " ago.",
                    "/sales",
                    null,
                    lastSale));
        }
    }

    // ---------------------------------------------------------------- expenses

    private void expenseSpikeAlert(int businessId, int percent, List<NotificationAlert> out) {
        YearMonth thisMonth = YearMonth.now(ZoneOffset.UTC);
        OffsetDateTime thisStart = thisMonth.atDay(1).atStartOfDay().atOffset(ZoneOffset.UTC);
        OffsetDateTime lastStart = thisStart.minusMonths(1);
        OffsetDateTime nextStart = thisStart.plusMonths(1);

        long lastTotal = expenseTotal(businessId, lastStart, thisStart);
        long thisTotal = expenseTotal(businessId, thisStart, nextStart);

        // So far this month against ALL of last month: only a real overshoot trips it, never a
        // month that is simply early.
        if (lastTotal > 0 && thisTotal * 100 > lastTotal * (100L + percent)) {
            long actual = Math.round((thisTotal - lastTotal) * 100.0 / lastTotal);
            out.add(new NotificationAlert(
                    "expense-spike",
                    thisMonth.toString(),
                    "Expenses are up",
                    "Expenses this month are " + money(thisTotal) + " so far, already " + actual
                            + "% above last month's " + money(lastTotal) + ".",
                    "/expenses",
                    null,
                    null));
        }
    }

    private long expenseTotal(int businessId, OffsetDateTime from, OffsetDateTime to) {
        return jdbcClient.sql("""
                        SELECT COALESCE(SUM(ei.total_cents), 0)
                        FROM expenses e JOIN expense_items ei ON ei.expense_id = e.id
                        WHERE e.business_id = :businessId AND e.incurred_at >= :from AND e.incurred_at < :to
                        """)
                .param("businessId", businessId)
                .param("from", from)
                .param("to", to)
                .query(Long.class)
                .single();
    }

    private static String money(long cents) {
        return String.format(Locale.CANADA, "$%,.2f CAD", cents / 100.0);
    }

    // ---------------------------------------------------------------- new devices

    private record NewDevice(long eventId, String userAgent, Instant at) {}

    /**
     * Recent logins from a browser the business had never logged in from before. The very first
     * login (registration) is skipped, and so is this browser.
     */
    private void newDeviceAlerts(int businessId, String currentUserAgent, List<NotificationAlert> out) {
        List<NewDevice> devices = jdbcClient.sql("""
                        SELECT e.id, e.user_agent, e.logged_in_at
                        FROM login_events e
                        WHERE e.business_id = :businessId
                          AND e.logged_in_at >= now() - make_interval(days => :days)
                          AND e.user_agent IS NOT NULL
                          AND e.user_agent <> :currentUserAgent
                          AND EXISTS (SELECT 1 FROM login_events p
                                      WHERE p.business_id = e.business_id AND p.id < e.id)
                          AND NOT EXISTS (SELECT 1 FROM login_events p
                                          WHERE p.business_id = e.business_id AND p.id < e.id
                                            AND p.user_agent = e.user_agent)
                        ORDER BY e.id DESC
                        LIMIT 3
                        """)
                .param("businessId", businessId)
                .param("days", NEW_DEVICE_DAYS)
                .param("currentUserAgent", currentUserAgent == null ? "" : currentUserAgent)
                .query((rs, rowNum) -> new NewDevice(
                        rs.getLong("id"),
                        rs.getString("user_agent"),
                        rs.getObject("logged_in_at", OffsetDateTime.class).toInstant()))
                .list();

        for (NewDevice device : devices) {
            out.add(new NotificationAlert(
                    "new-device",
                    String.valueOf(device.eventId()),
                    "New device logged in",
                    "A device you haven't used before logged in to your account.",
                    "/settings/security",
                    device.userAgent(),
                    device.at()));
        }
    }

    // ---------------------------------------------------------------- helpers

    private NotificationSettings settingsOf(int businessId) {
        return jdbcClient.sql("""
                        SELECT low_stock, out_of_stock, new_device, no_sales, no_sales_days,
                               expense_spike, expense_spike_percent
                        FROM notification_settings WHERE business_id = :businessId
                        """)
                .param("businessId", businessId)
                .query((rs, rowNum) -> new NotificationSettings(
                        rs.getBoolean("low_stock"),
                        rs.getBoolean("out_of_stock"),
                        rs.getBoolean("new_device"),
                        rs.getBoolean("no_sales"),
                        rs.getInt("no_sales_days"),
                        rs.getBoolean("expense_spike"),
                        rs.getInt("expense_spike_percent")))
                .optional()
                .orElse(NotificationSettings.DEFAULTS);
    }

    private static String clip(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return null;
        }
        return userAgent.length() > MAX_USER_AGENT ? userAgent.substring(0, MAX_USER_AGENT) : userAgent;
    }

    private static String plural(int count, String one, String many) {
        return count + " " + (count == 1 ? one : many);
    }
}
