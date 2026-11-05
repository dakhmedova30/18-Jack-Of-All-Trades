package ca.jackofalltrades.analytics;

import ca.jackofalltrades.auth.Business;
import ca.jackofalltrades.auth.BusinessRepository;
import ca.jackofalltrades.analytics.AnalyticsQueries.TaggedLine;
import ca.jackofalltrades.analytics.AnalyticsSummary.TagSeries;
import ca.jackofalltrades.analytics.AnalyticsSummary.TagTotal;
import ca.jackofalltrades.analytics.AnalyticsWindow.Bucket;
import ca.jackofalltrades.common.api.NotFoundException;
import ca.jackofalltrades.common.security.CurrentBusiness;
import ca.jackofalltrades.currency.CurrencyTotals;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The Analytics dashboard (contract §6), ported from the demo's analytics.service.ts. Sale and
 * expense lines are grouped by their parent's first tag: the top 3 tags by total, the rest
 * folded into "Other". Ties between equal totals keep the order the database returned, as the demo.
 */
@Service
public class AnalyticsService {

    static final String OTHER = "Other";
    static final int MAX_TAG_SERIES = 3;
    /** Horizontal bars have room for more categories than the stacked and donut charts. */
    static final int MAX_INVENTORY_TAGS = 7;

    private final AnalyticsQueries queries;
    private final CurrentBusiness currentBusiness;
    private final BusinessRepository businesses;
    private final CurrencyTotals currencyTotals;

    public AnalyticsService(
            AnalyticsQueries queries,
            CurrentBusiness currentBusiness,
            BusinessRepository businesses,
            CurrencyTotals currencyTotals) {
        this.queries = queries;
        this.currentBusiness = currentBusiness;
        this.businesses = businesses;
        this.currencyTotals = currencyTotals;
    }

    @Transactional(readOnly = true)
    public AnalyticsSummary summary(String range, Instant now) {
        int businessId = currentBusiness.id();
        String targetCurrency = businesses.findById(businessId)
                .map(Business::getCurrency)
                .orElseThrow(() -> new NotFoundException("Business", businessId));
        AnalyticsWindow window = AnalyticsWindow.forRange(range, now);
        List<TaggedLine> revenue = queries.revenueLines(businessId, window.start());
        List<TaggedLine> expenses = queries.expenseLines(businessId, window.start());

        // Revenue and the sales-by-tag donut share one top-tag cut, so a tag means the same in both charts.
        List<String> revenueTags = topTagsInCurrency(revenue, MAX_TAG_SERIES, targetCurrency);
        List<String> expenseTags = topTagsInCurrency(expenses, MAX_TAG_SERIES, targetCurrency);

        Map<String, Map<String, Long>> salesByTagByCurrency = new LinkedHashMap<>();
        for (TaggedLine line : revenue) {
            String label = revenueTags.contains(line.tag()) ? line.tag() : OTHER;
            salesByTagByCurrency.computeIfAbsent(label, unused -> new LinkedHashMap<>())
                    .merge(line.currency(), line.totalCents(), Long::sum);
        }
        Map<String, Long> salesByTag = new LinkedHashMap<>();
        salesByTagByCurrency.forEach(
                (tag, subtotal) -> salesByTag.put(tag, currencyTotals.convertSubtotals(subtotal, targetCurrency)));

        long totalRevenue = totalInCurrency(revenue, targetCurrency);
        long totalExpenses = totalInCurrency(expenses, targetCurrency);
        return new AnalyticsSummary(
                range,
                window.granularity(),
                window.buckets().stream().map(Bucket::key).toList(),
                window.buckets().stream().map(Bucket::label).toList(),
                totalRevenue,
                totalExpenses,
                totalRevenue - totalExpenses,
                tagSeriesInCurrency(revenue, window, revenueTags, targetCurrency),
                tagSeriesInCurrency(expenses, window, expenseTags, targetCurrency),
                salesByTag.entrySet().stream()
                        .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                        .map(entry -> new TagTotal(entry.getKey(), entry.getValue()))
                        .toList());
    }

    /** Current stock by first tag; tags past the top 7 fold into "Other", listed last. */
    @Transactional(readOnly = true)
    public InventoryByTag inventory() {
        List<AnalyticsQueries.TagStock> rows = queries.stockByTag(currentBusiness.id());
        List<InventoryByTag.TagStock> byTag = new ArrayList<>();
        long otherQuantity = 0;
        long otherItems = 0;
        for (int i = 0; i < rows.size(); i++) {
            AnalyticsQueries.TagStock row = rows.get(i);
            if (i < MAX_INVENTORY_TAGS) {
                byTag.add(new InventoryByTag.TagStock(row.tag(), row.quantity(), row.itemCount()));
            } else {
                otherQuantity += row.quantity();
                otherItems += row.itemCount();
            }
        }
        if (rows.size() > MAX_INVENTORY_TAGS) {
            byTag.add(new InventoryByTag.TagStock(OTHER, otherQuantity, otherItems));
        }
        return new InventoryByTag(byTag,
                rows.stream().mapToLong(AnalyticsQueries.TagStock::quantity).sum(),
                rows.stream().mapToLong(AnalyticsQueries.TagStock::itemCount).sum());
    }

    /** Up to {@code max} tags with the largest totals; a stable sort keeps ties in the order first seen. */
    static List<String> topTags(List<TaggedLine> lines, int max) {
        Map<String, Long> totals = new LinkedHashMap<>();
        for (TaggedLine line : lines) {
            totals.merge(line.tag(), line.totalCents(), Long::sum);
        }
        return totals.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue(Comparator.reverseOrder()))
                .limit(max)
                .map(Map.Entry::getKey)
                .toList();
    }

    private List<String> topTagsInCurrency(List<TaggedLine> lines, int max, String targetCurrency) {
        Map<String, Map<String, Long>> totalsByTag = new LinkedHashMap<>();
        for (TaggedLine line : lines) {
            totalsByTag.computeIfAbsent(line.tag(), unused -> new LinkedHashMap<>())
                    .merge(line.currency(), line.totalCents(), Long::sum);
        }
        return totalsByTag.entrySet().stream()
                .map(entry -> Map.entry(entry.getKey(),
                        currencyTotals.convertSubtotals(entry.getValue(), targetCurrency)))
                .sorted(Map.Entry.<String, Long>comparingByValue(Comparator.reverseOrder()))
                .limit(max)
                .map(Map.Entry::getKey)
                .toList();
    }

    private long totalInCurrency(List<TaggedLine> lines, String targetCurrency) {
        Map<String, Long> totalsByCurrency = new LinkedHashMap<>();
        for (TaggedLine line : lines) {
            totalsByCurrency.merge(line.currency(), line.totalCents(), Long::sum);
        }
        return currencyTotals.convertSubtotals(totalsByCurrency, targetCurrency);
    }

    /**
     * One series per kept tag, then "Other", each aligned to the buckets. A series exists only if
     * it has at least one line in a bucket; lines after the last bucket (future dates) are skipped here.
     */
    static List<TagSeries> tagSeries(List<TaggedLine> lines, AnalyticsWindow window, List<String> keptTags) {
        Map<String, Integer> bucketIndex = new HashMap<>();
        for (int i = 0; i < window.buckets().size(); i++) {
            bucketIndex.put(window.buckets().get(i).key(), i);
        }

        Map<String, long[]> valuesByLabel = new HashMap<>();
        for (TaggedLine line : lines) {
            Integer index = bucketIndex.get(bucketKey(line.at(), window.granularity()));
            if (index == null) {
                continue;
            }
            String label = keptTags.contains(line.tag()) ? line.tag() : OTHER;
            valuesByLabel.computeIfAbsent(label, unused -> new long[window.buckets().size()])[index] += line.totalCents();
        }
        List<String> order = new ArrayList<>(keptTags);
        order.add(OTHER);
        return order.stream()
                .filter(valuesByLabel::containsKey)
                .map(label -> new TagSeries(label, Arrays.stream(valuesByLabel.get(label)).boxed().toList()))
                .toList();
    }

    private List<TagSeries> tagSeriesInCurrency(
            List<TaggedLine> lines, AnalyticsWindow window, List<String> keptTags, String targetCurrency) {
        Map<String, Integer> bucketIndex = new HashMap<>();
        for (int i = 0; i < window.buckets().size(); i++) {
            bucketIndex.put(window.buckets().get(i).key(), i);
        }
        Map<String, Map<Integer, Map<String, Long>>> values = new HashMap<>();
        for (TaggedLine line : lines) {
            Integer index = bucketIndex.get(bucketKey(line.at(), window.granularity()));
            if (index == null) {
                continue;
            }
            String label = keptTags.contains(line.tag()) ? line.tag() : OTHER;
            values.computeIfAbsent(label, unused -> new HashMap<>())
                    .computeIfAbsent(index, unused -> new LinkedHashMap<>())
                    .merge(line.currency(), line.totalCents(), Long::sum);
        }

        List<String> order = new ArrayList<>(keptTags);
        order.add(OTHER);
        return order.stream()
                .filter(values::containsKey)
                .map(label -> {
                    Map<Integer, Map<String, Long>> byBucket = values.get(label);
                    List<Long> cents = new ArrayList<>(window.buckets().size());
                    for (int i = 0; i < window.buckets().size(); i++) {
                        cents.add(currencyTotals.convertSubtotals(
                                byBucket.getOrDefault(i, Map.of()), targetCurrency));
                    }
                    return new TagSeries(label, cents);
                })
                .toList();
    }

    private static String bucketKey(Instant at, String granularity) {
        LocalDate day = LocalDate.ofInstant(at, ZoneOffset.UTC);
        return "month".equals(granularity) ? YearMonth.from(day).toString() : day.toString();
    }

}
