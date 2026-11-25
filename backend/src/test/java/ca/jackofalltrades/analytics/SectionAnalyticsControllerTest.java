package ca.jackofalltrades.analytics;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ca.jackofalltrades.PostgresTestBase;
import jakarta.servlet.http.Cookie;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;

/**
 * GET /api/analytics/sales-trends, /expense-trends and /stock-health, the deeper Analytics pages.
 * Dates are relative to the real clock: sales are dated at UTC midnight, as the app records them,
 * and this month's always fall on its 1st, so they're never in the future.
 */
class SectionAnalyticsControllerTest extends PostgresTestBase {

    @Autowired
    private JdbcClient jdbcClient;

    private static OffsetDateTime midnight(LocalDate day) {
        return day.atStartOfDay().atOffset(ZoneOffset.UTC);
    }

    /** A sale in the named channel, with no lines yet. */
    private int newSale(int businessId, LocalDate day, String channel) {
        return jdbcClient.sql("""
                        INSERT INTO sales (business_id, sold_at, channel_id)
                        VALUES (:b, :at, (SELECT id FROM channels WHERE business_id = :b AND name = :channel))
                        RETURNING id
                        """)
                .param("b", businessId).param("at", midnight(day)).param("channel", channel)
                .query(Integer.class).single();
    }

    /** A sale with one line of {@code totalCents} that isn't linked to an item. */
    private int insertSale(int businessId, LocalDate day, String channel, int totalCents) {
        int saleId = newSale(businessId, day, channel);
        addSaleLine(saleId, null, 1, totalCents);
        return saleId;
    }

    private void addSaleLine(int saleId, Integer itemId, int quantity, int totalCents) {
        jdbcClient.sql("""
                        INSERT INTO sale_items (sale_id, item_id, item_name, quantity, unit_price_cents, total_cents)
                        VALUES (:sale, :item, 'Thing', :quantity, :price, :total)
                        """)
                .param("sale", saleId).param("item", itemId).param("quantity", quantity)
                .param("price", totalCents / quantity).param("total", totalCents)
                .update();
    }

    /** A sale today, or {@code daysAgo} days back, of {@code quantity} units of an item at 1.00 each. */
    private void sellItem(int businessId, int itemId, int quantity, int daysAgo) {
        int saleId = newSale(businessId, LocalDate.now(ZoneOffset.UTC).minusDays(daysAgo), "In person");
        addSaleLine(saleId, itemId, quantity, quantity * 100);
    }

    private int insertExpense(int businessId, LocalDate day, String... tags) {
        return jdbcClient.sql("""
                        INSERT INTO expenses (business_id, incurred_at, tags) VALUES (:b, :at, :tags) RETURNING id
                        """)
                .param("b", businessId).param("at", midnight(day)).param("tags", tags)
                .query(Integer.class).single();
    }

    /** An expense line; linked to an item it's a restock, otherwise a running cost. */
    private void addExpenseLine(int expenseId, Integer itemId, int totalCents) {
        jdbcClient.sql("""
                        INSERT INTO expense_items (expense_id, item_id, item_name, quantity, unit_cost_cents, total_cents)
                        VALUES (:expense, :item, 'Cost', 1, :total, :total)
                        """)
                .param("expense", expenseId).param("item", itemId).param("total", totalCents).update();
    }

    private int insertItem(int businessId, String name, int quantity, int priceCents, String... tags) {
        return jdbcClient.sql("""
                        INSERT INTO items (business_id, name, quantity, unit_price_cents, tags)
                        VALUES (:b, :name, :quantity, :price, :tags) RETURNING id
                        """)
                .param("b", businessId).param("name", name).param("quantity", quantity)
                .param("price", priceCents).param("tags", tags)
                .query(Integer.class).single();
    }

    @Test
    void requiresLogin() throws Exception {
        mockMvc.perform(get("/api/analytics/sales-trends")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/analytics/expense-trends")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/analytics/stock-health")).andExpect(status().isUnauthorized());
    }

    @Test
    void noDataStillHasTwelveMonthsAndSevenDays() throws Exception {
        Cookie cookie = registerAndLogin();
        YearMonth thisMonth = YearMonth.now(ZoneOffset.UTC);

        mockMvc.perform(get("/api/analytics/sales-trends").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.granularity").value("month"))
                .andExpect(jsonPath("$.buckets", hasSize(12)))
                .andExpect(jsonPath("$.buckets[0]").value(thisMonth.minusMonths(11).toString()))
                .andExpect(jsonPath("$.buckets[11]").value(thisMonth.toString()))
                .andExpect(jsonPath("$.bucketLabels", hasSize(12)))
                .andExpect(jsonPath("$.revenueCents", hasSize(12)))
                .andExpect(jsonPath("$.saleCounts[11]").value(0))
                .andExpect(jsonPath("$.byWeekday[*].day", contains("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")))
                .andExpect(jsonPath("$.byChannel").isEmpty());
        mockMvc.perform(get("/api/analytics/expense-trends").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.buckets", hasSize(12)))
                .andExpect(jsonPath("$.restockCents[11]").value(0))
                .andExpect(jsonPath("$.byTag").isEmpty());
        mockMvc.perform(get("/api/analytics/stock-health").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lowStockThreshold").value(5))
                .andExpect(jsonPath("$.outOfStockCount").value(0))
                .andExpect(jsonPath("$.paceDays").value(30))
                .andExpect(jsonPath("$.valueByTag").isEmpty())
                .andExpect(jsonPath("$.runningOut").isEmpty());
    }

    @Test
    void salesTrendsCountEachSaleOnceByMonthWeekdayAndChannel() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        YearMonth thisMonth = YearMonth.now(ZoneOffset.UTC);
        LocalDate first = thisMonth.atDay(1);
        LocalDate oldest = thisMonth.minusMonths(11).atDay(15);

        int twoLines = insertSale(business, first, "In person", 1000);
        addSaleLine(twoLines, null, 1, 500);
        insertSale(business, first, "Online", 2500);
        insertSale(business, oldest, "In person", 700);
        insertSale(business, thisMonth.minusMonths(12).atDay(15), "Online", 9900);   // before the window
        insertSale(business, thisMonth.plusMonths(1).atDay(1), "Online", 8800);       // after it

        // The two dates may share a weekday, so add up what each day should have.
        int[] counts = new int[7];
        int[] revenue = new int[7];
        counts[first.getDayOfWeek().getValue() - 1] += 2;
        revenue[first.getDayOfWeek().getValue() - 1] += 4000;
        counts[oldest.getDayOfWeek().getValue() - 1] += 1;
        revenue[oldest.getDayOfWeek().getValue() - 1] += 700;
        int firstDay = first.getDayOfWeek().getValue() - 1;
        int oldestDay = oldest.getDayOfWeek().getValue() - 1;

        mockMvc.perform(get("/api/analytics/sales-trends").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.revenueCents[11]").value(4000))
                .andExpect(jsonPath("$.saleCounts[11]").value(2))
                .andExpect(jsonPath("$.revenueCents[0]").value(700))
                .andExpect(jsonPath("$.saleCounts[0]").value(1))
                .andExpect(jsonPath("$.byWeekday[%d].saleCount", firstDay).value(counts[firstDay]))
                .andExpect(jsonPath("$.byWeekday[%d].revenueCents", firstDay).value(revenue[firstDay]))
                .andExpect(jsonPath("$.byWeekday[%d].saleCount", oldestDay).value(counts[oldestDay]))
                .andExpect(jsonPath("$.byWeekday[%d].revenueCents", oldestDay).value(revenue[oldestDay]))
                .andExpect(jsonPath("$.byChannel[*].label", contains("Online", "In person")))
                .andExpect(jsonPath("$.byChannel[*].valueCents", contains(2500, 2200)));
    }

    @Test
    void expenseTrendsSplitRestocksFromRunningCostsAndFoldSmallTags() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        YearMonth thisMonth = YearMonth.now(ZoneOffset.UTC);
        LocalDate first = thisMonth.atDay(1);
        int item = insertItem(business, "Mug", 3, 1200);

        int stock = insertExpense(business, first, "stock");
        addExpenseLine(stock, item, 3000);
        addExpenseLine(stock, null, 500);
        addExpenseLine(insertExpense(business, first, "rent"), null, 2000);
        insertSale(business, first, "In person", 4000);
        // Six bigger tags two months back push "stock" and "rent" into "Other".
        String[] tags = {"a", "b", "c", "d", "e", "f"};
        for (int i = 0; i < tags.length; i++) {
            addExpenseLine(insertExpense(business, thisMonth.minusMonths(2).atDay(10), tags[i]), null, 9000 - i * 1000);
        }
        addExpenseLine(insertExpense(business, thisMonth.minusMonths(12).atDay(10), "old"), null, 99_000);

        mockMvc.perform(get("/api/analytics/expense-trends").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.revenueCents[11]").value(4000))
                .andExpect(jsonPath("$.restockCents[11]").value(3000))
                .andExpect(jsonPath("$.runningCents[11]").value(2500))
                .andExpect(jsonPath("$.runningCents[9]").value(39_000))
                .andExpect(jsonPath("$.byTag[*].label", contains("a", "b", "c", "d", "e", "f", "Other")))
                .andExpect(jsonPath("$.byTag[0].valueCents").value(9000))
                .andExpect(jsonPath("$.byTag[6].valueCents").value(5500));
    }

    @Test
    void stockHealthCountsLevelsValuesTagsAndFindsWhatRunsOutFirst() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        int mug = insertItem(business, "Mug", 0, 1200, "kitchen");
        int candle = insertItem(business, "Candle", 3, 1500, "home");
        int soap = insertItem(business, "Soap", 40, 500, "bath");
        int towel = insertItem(business, "Towel", 10, 2000, "bath");
        insertItem(business, "Thing", 6, 100);

        sellItem(business, mug, 6, 0);
        sellItem(business, soap, 60, 10);
        sellItem(business, towel, 2, 0);
        sellItem(business, candle, 1, 40);   // before the last 30 days, so it isn't measured

        mockMvc.perform(get("/api/analytics/stock-health").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outOfStockCount").value(1))
                .andExpect(jsonPath("$.lowStockCount").value(1))
                .andExpect(jsonPath("$.wellStockedCount").value(3))
                .andExpect(jsonPath("$.valueByTag[*].label", contains("bath", "home", "Untagged", "kitchen")))
                .andExpect(jsonPath("$.valueByTag[*].valueCents", contains(40_000, 4500, 600, 0)))
                .andExpect(jsonPath("$.valueByTag[0].quantity").value(50))
                .andExpect(jsonPath("$.valueByTag[0].itemCount").value(2))
                .andExpect(jsonPath("$.runningOut[*].name", contains("Mug", "Soap", "Towel")))
                .andExpect(jsonPath("$.runningOut[*].unitsSold", contains(6, 60, 2)))
                .andExpect(jsonPath("$.runningOut[*].daysLeft", contains(0.0, 20.0, 150.0)));
    }

    @Test
    void trendsCoverTheChosenPeriodByDayWeekOrMonth() throws Exception {
        Cookie cookie = registerAndLogin();
        int business = businessId(cookie);
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        insertSale(business, today, "In person", 1000);
        insertSale(business, today.minusDays(10), "In person", 700);
        insertSale(business, today.minusDays(100), "Online", 500);   // only in the longer periods
        addExpenseLine(insertExpense(business, today.minusDays(10), "rent"), null, 300);
        String last30Days = "?from=" + today.minusDays(29) + "&to=" + today;

        // Up to a month: one bucket per day, as for the summary.
        mockMvc.perform(get("/api/analytics/sales-trends" + last30Days).cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.granularity").value("day"))
                .andExpect(jsonPath("$.buckets", hasSize(30)))
                .andExpect(jsonPath("$.buckets[29]").value(today.toString()))
                .andExpect(jsonPath("$.revenueCents[29]").value(1000))
                .andExpect(jsonPath("$.revenueCents[19]").value(700))
                .andExpect(jsonPath("$.byChannel[*].valueCents", contains(1700)));
        mockMvc.perform(get("/api/analytics/expense-trends" + last30Days).cookie(cookie))
                .andExpect(jsonPath("$.granularity").value("day"))
                .andExpect(jsonPath("$.runningCents[19]").value(300));
        // Up to about six months: by week, and the sale 100 days back now counts.
        mockMvc.perform(get("/api/analytics/sales-trends?from=" + today.minusDays(119) + "&to=" + today)
                        .cookie(cookie))
                .andExpect(jsonPath("$.granularity").value("week"))
                .andExpect(jsonPath("$.byChannel[*].label", contains("In person", "Online")))
                .andExpect(jsonPath("$.byChannel[*].valueCents", contains(1700, 500)));
        // A single past day: only what happened on it.
        LocalDate past = today.minusDays(100);
        mockMvc.perform(get("/api/analytics/sales-trends?from=" + past + "&to=" + past).cookie(cookie))
                .andExpect(jsonPath("$.buckets", contains(past.toString())))
                .andExpect(jsonPath("$.revenueCents", contains(500)))
                .andExpect(jsonPath("$.saleCounts", contains(1)));
        // Longer: by month.
        mockMvc.perform(get("/api/analytics/expense-trends?from=" + today.minusDays(400) + "&to=" + today)
                        .cookie(cookie))
                .andExpect(jsonPath("$.granularity").value("month"))
                .andExpect(jsonPath("$.byTag[*].label", contains("rent")));
    }

    @Test
    void aPeriodNeedsBothEndsTheRightWayRound() throws Exception {
        Cookie cookie = registerAndLogin();
        for (String path : new String[] {"/api/analytics/sales-trends", "/api/analytics/expense-trends"}) {
            mockMvc.perform(get(path + "?from=2026-10-01").cookie(cookie))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.message").value("Give both 'from' and 'to', or neither"));
            mockMvc.perform(get(path + "?from=2026-10-02&to=2026-10-01").cookie(cookie))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.message").value("'from' must be on or before 'to'"));
            mockMvc.perform(get(path + "?from=1900-01-01&to=2026-10-01").cookie(cookie))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void daysLeftRoundsToOneDecimal() {
        assertThat(SectionAnalyticsService.daysLeft(1, 3)).isEqualTo(10.0);
        assertThat(SectionAnalyticsService.daysLeft(1, 7)).isEqualTo(4.3);
        assertThat(SectionAnalyticsService.daysLeft(0, 5)).isEqualTo(0.0);
    }
}
