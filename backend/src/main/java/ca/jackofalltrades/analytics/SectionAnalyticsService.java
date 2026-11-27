package ca.jackofalltrades.analytics;

import ca.jackofalltrades.analytics.AnalyticsQueries.CostLine;
import ca.jackofalltrades.analytics.AnalyticsQueries.SaleTotal;
import ca.jackofalltrades.analytics.AnalyticsSummary.TagSeries;
import ca.jackofalltrades.analytics.AnalyticsSummary.TagTotal;
import ca.jackofalltrades.analytics.AnalyticsWindow.Bucket;
import ca.jackofalltrades.auth.Business;
import ca.jackofalltrades.auth.BusinessRepository;
import ca.jackofalltrades.common.api.BadRequestException;
import ca.jackofalltrades.common.api.NotFoundException;
import ca.jackofalltrades.common.security.CurrentBusiness;
import ca.jackofalltrades.currency.CurrencyTotals;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Stream;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The charts on the deeper Analytics pages (Inventory, Sales and Expense Analytics). Sales and
 * expenses keep the currency they were recorded in, so each currency's subtotal is converted to
 * the account's currency before it's added, as on the main dashboard. Days and months are UTC.
 */
@Service
public class SectionAnalyticsService {

    /** With no period chosen, the trends cover this many calendar months, this one included. */
    static final int DEFAULT_TREND_MONTHS = 12;
    /** Spending by tag shows this many tags, then "Other". */
    static final int MAX_EXPENSE_TAGS = 6;
    /**
     * Revenue over time has a line for this many channels, and spending over time for this many
     * tags, then "Other": as the summary's series, since more lines crossing each other can't be
     * told apart by color.
     */
    static final int MAX_TREND_SERIES = AnalyticsService.MAX_TAG_SERIES;
    /** Stock value by tag shows this many tags, then "Other", as Inventory Overview does. */
    static final int MAX_STOCK_TAGS = AnalyticsService.MAX_INVENTORY_TAGS;
    /** "Running out soon" measures each item's selling pace over this many days, today included. */
    static final int PACE_DAYS = 30;
    static final int RUNNING_OUT_LIMIT = 8;

    private final AnalyticsQueries queries;
    private final CurrentBusiness currentBusiness;
    private final BusinessRepository businesses;
    private final CurrencyTotals currencyTotals;

    public SectionAnalyticsService(
            AnalyticsQueries queries,
            CurrentBusiness currentBusiness,
            BusinessRepository businesses,
            CurrencyTotals currencyTotals) {
        this.queries = queries;
        this.currentBusiness = currentBusiness;
        this.businesses = businesses;
        this.currencyTotals = currencyTotals;
    }

    /**
     * The period {@code from} to {@code to} (both included), bucketed by day, week or month as the
     * summary's chosen periods are; with neither, the last 12 calendar months by month. 400 if only
     * one is given, or the period is backwards or too long, as for the summary.
     */
    static AnalyticsWindow window(LocalDate today, LocalDate from, LocalDate to) {
        if (from == null && to == null) {
            return AnalyticsWindow.lastMonths(today, DEFAULT_TREND_MONTHS);
        }
        if (from == null || to == null) {
            throw new BadRequestException("Give both 'from' and 'to', or neither");
        }
        if (from.isAfter(to)) {
            throw new BadRequestException("'from' must be on or before 'to'");
        }
        if (!to.isBefore(from.plusYears(AnalyticsService.MAX_PERIOD_YEARS))) {
            throw new BadRequestException(
                    "The period must be shorter than " + AnalyticsService.MAX_PERIOD_YEARS + " years");
        }
        return AnalyticsWindow.between(from, to);
    }

    /**
     * Revenue (in all and by channel) and sale count by day, week or month, by day of the week and
     * by channel, over the period {@code from} to {@code to} (see {@link #window}).
     *
     * @param channelIds only these channels' sales count; null or empty for every channel
     */
    @Transactional(readOnly = true)
    public SalesTrends salesTrends(LocalDate today, LocalDate from, LocalDate to, List<Integer> channelIds) {
        AnalyticsWindow window = window(today, from, to);
        List<Integer> onlyChannels = chosen(channelIds == null ? null : channelIds.stream());
        int businessId = currentBusiness.id();
        String currency = business(businessId).getCurrency();
        Map<String, Integer> bucketIndex = bucketIndex(window);
        int buckets = window.buckets().size();

        long[] bucketCounts = new long[buckets];
        List<Map<String, Long>> bucketRevenue = subtotals(buckets);
        long[] weekdayCounts = new long[7];
        List<Map<String, Long>> weekdayRevenue = subtotals(7);
        Map<String, Map<String, Long>> byChannel = new LinkedHashMap<>();
        Map<String, List<Map<String, Long>>> byChannelAndBucket = new HashMap<>();
        for (SaleTotal sale : queries.saleTotals(businessId, window.start(), window.end(), onlyChannels)) {
            Integer bucket = bucketIndex.get(AnalyticsService.bucketKey(sale.at(), window.granularity()));
            if (bucket == null) {
                continue;
            }
            int weekday = LocalDate.ofInstant(sale.at(), ZoneOffset.UTC).getDayOfWeek().getValue() - 1;
            bucketCounts[bucket]++;
            bucketRevenue.get(bucket).merge(sale.currency(), sale.totalCents(), Long::sum);
            weekdayCounts[weekday]++;
            weekdayRevenue.get(weekday).merge(sale.currency(), sale.totalCents(), Long::sum);
            // A sale with no lines yet counts as a sale, but gives its channel no revenue to list.
            if (sale.totalCents() != 0) {
                byChannel.computeIfAbsent(sale.channel(), unused -> new HashMap<>())
                        .merge(sale.currency(), sale.totalCents(), Long::sum);
                byChannelAndBucket.computeIfAbsent(sale.channel(), unused -> subtotals(buckets)).get(bucket)
                        .merge(sale.currency(), sale.totalCents(), Long::sum);
            }
        }

        List<SalesTrends.WeekdayTotal> byWeekday = new ArrayList<>();
        for (DayOfWeek day : DayOfWeek.values()) {
            int i = day.getValue() - 1;
            byWeekday.add(new SalesTrends.WeekdayTotal(day.getDisplayName(TextStyle.SHORT, Locale.ENGLISH),
                    weekdayCounts[i], convert(weekdayRevenue.get(i), currency)));
        }

        List<TagTotal> channels = largestFirst(byChannel, currency);
        return new SalesTrends(
                window.granularity(),
                window.buckets().stream().map(Bucket::key).toList(),
                window.buckets().stream().map(Bucket::label).toList(),
                convertEach(bucketRevenue, currency),
                topSeries(channels, byChannelAndBucket, buckets, currency),
                Arrays.stream(bucketCounts).boxed().toList(),
                byWeekday,
                channels);
    }

    /**
     * Restock and running costs by day, week or month next to revenue, and spending by tag, over
     * the period {@code from} to {@code to} (see {@link #window}).
     *
     * @param tags only expenses whose first tag ("Untagged" for none) is one of these count; null,
     *     empty or only blanks for every expense. Revenue is never narrowed: sales have no expense tags.
     */
    @Transactional(readOnly = true)
    public ExpenseTrends expenseTrends(LocalDate today, LocalDate from, LocalDate to, List<String> tags) {
        AnalyticsWindow window = window(today, from, to);
        List<String> onlyTags = chosen(tags == null ? null
                : tags.stream().filter(tag -> tag != null && !tag.isBlank()).map(String::strip));
        int businessId = currentBusiness.id();
        String currency = business(businessId).getCurrency();
        Map<String, Integer> bucketIndex = bucketIndex(window);
        int buckets = window.buckets().size();

        List<Map<String, Long>> revenue = subtotals(buckets);
        for (SaleTotal sale : queries.saleTotals(businessId, window.start(), window.end(), null)) {
            Integer bucket = bucketIndex.get(AnalyticsService.bucketKey(sale.at(), window.granularity()));
            if (bucket != null) {
                revenue.get(bucket).merge(sale.currency(), sale.totalCents(), Long::sum);
            }
        }

        List<Map<String, Long>> restock = subtotals(buckets);
        List<Map<String, Long>> running = subtotals(buckets);
        Map<String, Map<String, Long>> byTag = new LinkedHashMap<>();
        Map<String, List<Map<String, Long>>> byTagAndBucket = new HashMap<>();
        for (CostLine line : queries.costLines(businessId, window.start(), window.end(), onlyTags)) {
            Integer bucket = bucketIndex.get(AnalyticsService.bucketKey(line.at(), window.granularity()));
            if (bucket == null) {
                continue;
            }
            (line.restock() ? restock : running).get(bucket).merge(line.currency(), line.totalCents(), Long::sum);
            byTag.computeIfAbsent(line.tag(), unused -> new HashMap<>())
                    .merge(line.currency(), line.totalCents(), Long::sum);
            byTagAndBucket.computeIfAbsent(line.tag(), unused -> subtotals(buckets)).get(bucket)
                    .merge(line.currency(), line.totalCents(), Long::sum);
        }

        List<TagTotal> ranked = largestFirst(byTag, currency);
        return new ExpenseTrends(
                window.granularity(),
                window.buckets().stream().map(Bucket::key).toList(),
                window.buckets().stream().map(Bucket::label).toList(),
                convertEach(revenue, currency),
                convertEach(restock, currency),
                convertEach(running, currency),
                topSeries(ranked, byTagAndBucket, buckets, currency),
                foldIntoOther(ranked, MAX_EXPENSE_TAGS));
    }

    /**
     * One series per top label (the {@link #MAX_TREND_SERIES} first in {@code ranked}, the largest
     * totals), then the rest added up as "Other" if there's any rest, each value converted per bucket.
     */
    private List<TagSeries> topSeries(List<TagTotal> ranked, Map<String, List<Map<String, Long>>> byLabelAndBucket,
            int buckets, String currency) {
        List<TagSeries> series = new ArrayList<>();
        List<Map<String, Long>> other = subtotals(buckets);
        for (int i = 0; i < ranked.size(); i++) {
            List<Map<String, Long>> values = byLabelAndBucket.get(ranked.get(i).label());
            if (i < MAX_TREND_SERIES) {
                series.add(new TagSeries(ranked.get(i).label(), convertEach(values, currency)));
                continue;
            }
            for (int b = 0; b < buckets; b++) {
                Map<String, Long> target = other.get(b);
                values.get(b).forEach((code, cents) -> target.merge(code, cents, Long::sum));
            }
        }
        if (ranked.size() > MAX_TREND_SERIES) {
            series.add(new TagSeries(AnalyticsService.OTHER, convertEach(other, currency)));
        }
        return series;
    }

    /** Every first tag on this business's expenses, for Expense Analytics' tag filter (see AnalyticsQueries). */
    @Transactional(readOnly = true)
    public List<String> expenseTags() {
        return queries.expenseFirstTags(currentBusiness.id());
    }

    /** Stock levels now, stock value by tag, and the items that will run out first at the last 30 days' pace. */
    @Transactional(readOnly = true)
    public StockHealth stockHealth(LocalDate today) {
        int businessId = currentBusiness.id();
        int threshold = business(businessId).getLowStockThreshold();
        AnalyticsQueries.StockCounts counts = queries.stockCounts(businessId, threshold);

        List<StockHealth.TagValue> valueByTag = new ArrayList<>();
        StockHealth.TagValue other = new StockHealth.TagValue(AnalyticsService.OTHER, 0, 0, 0);
        List<AnalyticsQueries.TagValue> rows = queries.stockValueByTag(businessId);
        for (int i = 0; i < rows.size(); i++) {
            AnalyticsQueries.TagValue row = rows.get(i);
            if (i < MAX_STOCK_TAGS) {
                valueByTag.add(new StockHealth.TagValue(row.tag(), row.valueCents(), row.quantity(), row.itemCount()));
            } else {
                other = new StockHealth.TagValue(AnalyticsService.OTHER, other.valueCents() + row.valueCents(),
                        other.quantity() + row.quantity(), other.itemCount() + row.itemCount());
            }
        }
        if (rows.size() > MAX_STOCK_TAGS) {
            valueByTag.add(other);
        }

        Instant since = startOf(today.minusDays(PACE_DAYS - 1));
        Instant until = startOf(today.plusDays(1));
        List<StockHealth.RunningOutItem> runningOut = queries
                .runningOut(businessId, since, until, RUNNING_OUT_LIMIT).stream()
                .map(item -> new StockHealth.RunningOutItem(item.id(), item.name(), item.quantity(),
                        item.unitsSold(), daysLeft(item.quantity(), item.unitsSold())))
                .toList();

        return new StockHealth(threshold, counts.outOfStock(), counts.low(), counts.wellStocked(),
                valueByTag, PACE_DAYS, runningOut);
    }

    /** How many days {@code quantity} lasts at {@code unitsSold} per {@link #PACE_DAYS}, to one decimal. */
    static double daysLeft(int quantity, long unitsSold) {
        return BigDecimal.valueOf((long) quantity * PACE_DAYS)
                .divide(BigDecimal.valueOf(unitsSold), 1, RoundingMode.HALF_UP)
                .doubleValue();
    }

    /** Totals by label, largest first and then by label; {@code foldIntoOther} relies on that order. */
    private List<TagTotal> largestFirst(Map<String, Map<String, Long>> subtotalsByLabel, String currency) {
        return subtotalsByLabel.entrySet().stream()
                .map(entry -> new TagTotal(entry.getKey(), convert(entry.getValue(), currency)))
                .sorted(Comparator.comparingLong(TagTotal::valueCents).reversed().thenComparing(TagTotal::label))
                .toList();
    }

    /** The first {@code max} totals, then the rest added up as "Other" (only if there is a rest). */
    static List<TagTotal> foldIntoOther(List<TagTotal> totals, int max) {
        if (totals.size() <= max) {
            return totals;
        }
        List<TagTotal> kept = new ArrayList<>(totals.subList(0, max));
        long rest = totals.subList(max, totals.size()).stream().mapToLong(TagTotal::valueCents).sum();
        kept.add(new TagTotal(AnalyticsService.OTHER, rest));
        return kept;
    }

    private long convert(Map<String, Long> centsByCurrency, String currency) {
        return currencyTotals.convertSubtotals(centsByCurrency, currency);
    }

    private List<Long> convertEach(List<Map<String, Long>> subtotals, String currency) {
        return subtotals.stream().map(byCurrency -> convert(byCurrency, currency)).toList();
    }

    private static List<Map<String, Long>> subtotals(int count) {
        List<Map<String, Long>> list = new ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            list.add(new HashMap<>());
        }
        return list;
    }

    /**
     * The channels or tags a filter chose, without nulls or repeats; null, meaning no narrowing,
     * when none are left.
     */
    private static <T> List<T> chosen(Stream<T> values) {
        if (values == null) {
            return null;
        }
        List<T> chosen = values.filter(Objects::nonNull).distinct().toList();
        return chosen.isEmpty() ? null : chosen;
    }

    /** Each bucket's key and its position, to file records by AnalyticsService.bucketKey. */
    private static Map<String, Integer> bucketIndex(AnalyticsWindow window) {
        Map<String, Integer> index = new HashMap<>();
        for (int i = 0; i < window.buckets().size(); i++) {
            index.put(window.buckets().get(i).key(), i);
        }
        return index;
    }

    private static Instant startOf(LocalDate day) {
        return day.atStartOfDay(ZoneOffset.UTC).toInstant();
    }

    private Business business(int businessId) {
        return businesses.findById(businessId).orElseThrow(() -> new NotFoundException("Business", businessId));
    }
}
