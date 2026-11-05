package ca.jackofalltrades.analytics;

import ca.jackofalltrades.analytics.AnalyticsQueries.TaggedLine;
import ca.jackofalltrades.analytics.AnalyticsSummary.TagSeries;
import ca.jackofalltrades.analytics.AnalyticsSummary.TagTotal;
import ca.jackofalltrades.analytics.AnalyticsWindow.Bucket;
import ca.jackofalltrades.common.api.BadRequestException;
import ca.jackofalltrades.common.security.CurrentBusiness;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.temporal.TemporalAdjusters;
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
    /** The summary's {@code range} for a chosen period. */
    static final String CUSTOM_RANGE = "custom";
    /** A chosen period must be shorter than this, which also caps the number of month buckets. */
    static final int MAX_PERIOD_YEARS = 100;

    private final AnalyticsQueries queries;
    private final CurrentBusiness currentBusiness;

    public AnalyticsService(AnalyticsQueries queries, CurrentBusiness currentBusiness) {
        this.queries = queries;
        this.currentBusiness = currentBusiness;
    }

    /** @param channelId only this channel's sales count; null for every channel */
    @Transactional(readOnly = true)
    public AnalyticsSummary summary(String range, Instant now, Integer channelId) {
        return summarize(range, AnalyticsWindow.forRange(range, now), channelId);
    }

    /** The chosen period {@code from} to {@code to}, both included; 400 if it's backwards or too long. */
    @Transactional(readOnly = true)
    public AnalyticsSummary summary(LocalDate from, LocalDate to, Integer channelId) {
        if (from.isAfter(to)) {
            throw new BadRequestException("'from' must be on or before 'to'");
        }
        if (!to.isBefore(from.plusYears(MAX_PERIOD_YEARS))) {
            throw new BadRequestException("The period must be shorter than " + MAX_PERIOD_YEARS + " years");
        }
        return summarize(CUSTOM_RANGE, AnalyticsWindow.between(from, to), channelId);
    }

    /** The first and last day with a sale or expense, for the date filter, and today (all UTC). */
    @Transactional(readOnly = true)
    public AnalyticsDateRange dateRange(LocalDate today) {
        AnalyticsQueries.RecordSpan span = queries.recordSpan(currentBusiness.id());
        return new AnalyticsDateRange(span.first(), span.last(), today);
    }

    /**
     * Expenses aren't recorded per channel, so {@code channelId} narrows only the revenue figures;
     * the expense figures, and so net profit, still cover every expense.
     */
    private AnalyticsSummary summarize(String range, AnalyticsWindow window, Integer channelId) {
        int businessId = currentBusiness.id();
        List<TaggedLine> revenue = queries.revenueLines(businessId, window.start(), window.end(), channelId);
        List<TaggedLine> expenses = queries.expenseLines(businessId, window.start(), window.end());

        // Revenue and the sales-by-tag donut share one top-tag cut, so a tag means the same in both charts.
        List<String> revenueTags = topTags(revenue, MAX_TAG_SERIES);
        List<String> expenseTags = topTags(expenses, MAX_TAG_SERIES);

        Map<String, Long> salesByTag = new LinkedHashMap<>();
        for (TaggedLine line : revenue) {
            salesByTag.merge(revenueTags.contains(line.tag()) ? line.tag() : OTHER, line.totalCents(), Long::sum);
        }

        long totalRevenue = total(revenue);
        long totalExpenses = total(expenses);
        return new AnalyticsSummary(
                range,
                window.granularity(),
                window.buckets().stream().map(Bucket::key).toList(),
                window.buckets().stream().map(Bucket::label).toList(),
                totalRevenue,
                totalExpenses,
                totalRevenue - totalExpenses,
                tagSeries(revenue, window, revenueTags),
                tagSeries(expenses, window, expenseTags),
                salesByTag.entrySet().stream()
                        .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                        .map(entry -> new TagTotal(entry.getKey(), entry.getValue()))
                        .toList(),
                queries.revenueByChannel(businessId, window.start(), window.end(), channelId));
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

    /** The key of the bucket {@code at} falls in: its month, its week's Monday, or its day. */
    private static String bucketKey(Instant at, String granularity) {
        LocalDate day = LocalDate.ofInstant(at, ZoneOffset.UTC);
        return switch (granularity) {
            case "month" -> YearMonth.from(day).toString();
            case "week" -> day.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).toString();
            default -> day.toString();
        };
    }

    private static long total(List<TaggedLine> lines) {
        return lines.stream().mapToLong(TaggedLine::totalCents).sum();
    }
}
