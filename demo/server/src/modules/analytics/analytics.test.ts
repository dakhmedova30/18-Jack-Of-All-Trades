import '../../env.js';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { connectDatabase, type Db } from '../../db/database.js';
import { createExpenseRepository } from '../expenses/expenses.repository.js';
import { createItemRepository } from '../items/items.repository.js';
import { createSaleRepository } from '../sales/sales.repository.js';
import type { TaggedLine } from './analytics.repository.js';
import {
  createAnalyticsService,
  buildTagSeries,
  daysWindow,
  monthsWindow,
  summaryWindowFor,
  topTags,
} from './analytics.service.js';

/**
 * These tests run against a real Postgres database given by TEST_DATABASE_URL
 * (in server/.env or the environment). Every table is emptied before each test,
 * so NEVER point it at a database whose data you care about.
 */
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  console.warn('TEST_DATABASE_URL is not set; skipping analytics tests. See server/.env.example.');
}

// A fixed reference instant, so date-window tests never depend on wall-clock
// time. March 2026, chosen arbitrarily (no daylight-saving edge cases to dodge
// since everything here is UTC).
const NOW = new Date('2026-03-15T12:00:00Z');

describe('date window helpers (pure, no database)', () => {
  it('monthsWindow returns N whole months ending at the month containing `now`', () => {
    const months = monthsWindow(3, NOW);
    expect(months.map((m) => m.key)).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(months.map((m) => m.label)).toEqual(['Jan', 'Feb', 'Mar']);
  });

  it('monthsWindow crosses a year boundary correctly', () => {
    const months = monthsWindow(3, new Date('2026-01-10T00:00:00Z'));
    expect(months.map((m) => m.key)).toEqual(['2025-11', '2025-12', '2026-01']);
  });

  it('daysWindow returns N calendar days ending at `now`', () => {
    const days = daysWindow(4, NOW); // 2026-03-15 is a Sunday
    expect(days.map((d) => d.key)).toEqual([
      '2026-03-12',
      '2026-03-13',
      '2026-03-14',
      '2026-03-15',
    ]);
    expect(days.map((d) => d.label)).toEqual(['Thu', 'Fri', 'Sat', 'Sun']);
  });
});

describe('summaryWindowFor (the "Show by" range filter, pure, no database)', () => {
  it('week: the last 7 days, weekday labels', () => {
    const { granularity, buckets } = summaryWindowFor('week', NOW);
    expect(granularity).toBe('day');
    expect(buckets.map((b) => b.key)).toEqual([
      '2026-03-09',
      '2026-03-10',
      '2026-03-11',
      '2026-03-12',
      '2026-03-13',
      '2026-03-14',
      '2026-03-15',
    ]);
    expect(buckets.map((b) => b.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  it('month: one bucket per day so far this month, day-of-month labels', () => {
    const { granularity, buckets } = summaryWindowFor('month', NOW); // NOW is March 15
    expect(granularity).toBe('day');
    expect(buckets).toHaveLength(15);
    expect(buckets[0]!.key).toBe('2026-03-01');
    expect(buckets.at(-1)!.key).toBe('2026-03-15');
    expect(buckets.map((b) => b.label)).toEqual(
      Array.from({ length: 15 }, (_, i) => String(i + 1)),
    );
  });

  it('ytd: one bucket per month so far this year', () => {
    const { granularity, buckets } = summaryWindowFor('ytd', NOW); // NOW is March
    expect(granularity).toBe('month');
    expect(buckets.map((b) => b.key)).toEqual(['2026-01', '2026-02', '2026-03']);
  });

  it('12months: the trailing 12 calendar months', () => {
    const { granularity, buckets } = summaryWindowFor('12months', NOW);
    expect(granularity).toBe('month');
    expect(buckets).toHaveLength(12);
    expect(buckets[0]!.key).toBe('2025-04');
    expect(buckets.at(-1)!.key).toBe('2026-03');
  });
});

describe('topTags / buildTagSeries (pure, no database)', () => {
  const lines: TaggedLine[] = [
    { at: '2026-03-01T00:00:00Z', tag: 'online', totalCents: 500 },
    { at: '2026-03-01T00:00:00Z', tag: 'online', totalCents: 300 },
    { at: '2026-03-02T00:00:00Z', tag: 'market', totalCents: 400 },
    { at: '2026-03-02T00:00:00Z', tag: 'wholesale', totalCents: 100 },
    { at: '2026-03-03T00:00:00Z', tag: 'pop-up', totalCents: 50 },
  ];

  it('keeps the top N tags by total and drops the rest', () => {
    expect(topTags(lines, 2)).toEqual(['online', 'market']);
  });

  it('folds everything outside the kept tags into "Other", preserving totals', () => {
    const months = monthsWindow(1, new Date('2026-03-15T00:00:00Z'));
    const series = buildTagSeries(lines, months, 'month', ['online', 'market']);

    expect(series.map((s) => s.label)).toEqual(['online', 'market', 'Other']);
    expect(series.find((s) => s.label === 'online')!.values).toEqual([800]);
    expect(series.find((s) => s.label === 'market')!.values).toEqual([400]);
    expect(series.find((s) => s.label === 'Other')!.values).toEqual([150]); // wholesale + pop-up

    const grandTotal = series.reduce((sum, s) => sum + s.values[0]!, 0);
    expect(grandTotal).toBe(lines.reduce((sum, l) => sum + l.totalCents, 0));
  });

  it('omits a series entirely if nothing falls into it', () => {
    const months = monthsWindow(1, new Date('2026-03-15T00:00:00Z'));
    const onlyOnline = buildTagSeries(
      lines.filter((l) => l.tag === 'online'),
      months,
      'month',
      ['online', 'market'],
    );
    expect(onlyOnline.map((s) => s.label)).toEqual(['online']); // no "market", no "Other"
  });
});

describe.skipIf(!testDatabaseUrl)('analytics service (real database)', () => {
  let db: Db;

  beforeAll(async () => {
    db = await connectDatabase({ connectionString: testDatabaseUrl! });
  });

  beforeEach(async () => {
    await db.query('TRUNCATE expense_items, expenses, sale_items, sales, items RESTART IDENTITY');
  });

  afterAll(async () => {
    await db?.end();
  });

  it('computes totals and monthly revenue by tag', async () => {
    const items = createItemRepository(db);
    const sales = createSaleRepository(db);
    const expenses = createExpenseRepository(db);

    const candle = await items.insert({
      name: 'Candle',
      quantity: 100,
      unitPriceCents: 1800,
      tags: [],
      note: '',
    });
    const soap = await items.insert({
      name: 'Soap',
      quantity: 100,
      unitPriceCents: 700,
      tags: [],
      note: '',
    });

    // Two sales this month (Mar), tagged 'online' and 'market'; one last month (Feb), 'online'.
    await sales.insert({
      soldAt: '2026-03-05T00:00:00Z',
      channelId: null,
      description: '',
      tags: ['online'],
      items: [
        {
          itemId: candle.id,
          itemName: candle.name,
          quantity: 2,
          unitPriceCents: 1800,
          totalCents: 3600,
        },
      ],
    });
    await sales.insert({
      soldAt: '2026-03-10T00:00:00Z',
      channelId: null,
      description: '',
      tags: ['market'],
      items: [
        {
          itemId: soap.id,
          itemName: soap.name,
          quantity: 3,
          unitPriceCents: 700,
          totalCents: 2100,
        },
      ],
    });
    await sales.insert({
      soldAt: '2026-02-20T00:00:00Z',
      channelId: null,
      description: '',
      tags: ['online'],
      items: [
        {
          itemId: candle.id,
          itemName: candle.name,
          quantity: 1,
          unitPriceCents: 1800,
          totalCents: 1800,
        },
      ],
    });
    // Outside the 6-month window (Mar back to Oct 2025): must not affect totals or buckets.
    await sales.insert({
      soldAt: '2025-01-01T00:00:00Z',
      channelId: null,
      description: '',
      tags: ['online'],
      items: [
        {
          itemId: candle.id,
          itemName: candle.name,
          quantity: 50,
          unitPriceCents: 1800,
          totalCents: 90000,
        },
      ],
    });

    // Both restock expenses fall within the default 12-month window (Apr 2025 -
    // Mar 2026), so both count toward totalExpensesCents.
    await expenses.insert({
      incurredAt: '2026-03-14T00:00:00Z',
      description: '',
      tags: ['supplier'],
      items: [
        {
          itemId: candle.id,
          itemName: candle.name,
          quantity: 10,
          unitCostCents: 700,
          totalCents: 7000,
        },
      ],
    });
    await expenses.insert({
      incurredAt: '2026-01-01T00:00:00Z',
      description: '',
      tags: ['supplier'],
      items: [
        { itemId: soap.id, itemName: soap.name, quantity: 5, unitCostCents: 300, totalCents: 1500 },
      ],
    });

    const service = createAnalyticsService(db);
    const summary = await service.getSummary({ now: NOW });

    // Totals are scoped to the (default, 12-month) range, so the 2025-01 sale
    // is excluded: 3600 + 2100 + 1800, not + 90000.
    expect(summary.totalRevenueCents).toBe(3600 + 2100 + 1800);
    expect(summary.totalExpensesCents).toBe(7000 + 1500);
    expect(summary.netProfitCents).toBe(summary.totalRevenueCents - summary.totalExpensesCents);

    expect(summary.range).toBe('12months');
    expect(summary.granularity).toBe('month');
    expect(summary.buckets).toEqual([
      '2025-04',
      '2025-05',
      '2025-06',
      '2025-07',
      '2025-08',
      '2025-09',
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
    ]);
    const online = summary.revenueSeries.find((s) => s.label === 'online')!;
    const market = summary.revenueSeries.find((s) => s.label === 'market')!;
    // Feb has 1800 (online), Mar has 3600 (online) + 2100 (market), at indexes
    // 10 and 11 of the 12-month window. The 2025-01 sale is before the window
    // (Apr 2025 - Mar 2026), so it's excluded from both the chart and the totals.
    expect(online.values).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1800, 3600]);
    expect(market.values).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2100]);

    // Same window+tags as the chart, so it also excludes the 2025-01 sale.
    expect(summary.salesByTag).toEqual(
      expect.arrayContaining([
        { label: 'online', valueCents: 1800 + 3600 },
        { label: 'market', valueCents: 2100 },
      ]),
    );

    // Expenses now share the same (monthly) window as revenue, so both
    // restock expenses land in it: Jan 2026 (index 9) and Mar 2026 (index 11).
    const supplierExpenses = summary.expenseSeries.find((s) => s.label === 'supplier')!;
    expect(supplierExpenses.values[9]).toBe(1500);
    expect(supplierExpenses.values[11]).toBe(7000);
  });

  it('folds more than 3 tags into "Other" and keeps totals consistent', async () => {
    const items = createItemRepository(db);
    const sales = createSaleRepository(db);
    const tagTotals: [string, number][] = [
      ['a', 500],
      ['b', 400],
      ['c', 300],
      ['d', 200],
      ['e', 100],
    ];
    const item = await items.insert({
      name: 'Widget',
      quantity: 100,
      unitPriceCents: 100,
      tags: [],
      note: '',
    });
    for (const [tag, totalCents] of tagTotals) {
      await sales.insert({
        soldAt: '2026-03-10T00:00:00Z',
        channelId: null,
        description: '',
        tags: [tag],
        items: [
          {
            itemId: item.id,
            itemName: item.name,
            quantity: 1,
            unitPriceCents: totalCents,
            totalCents,
          },
        ],
      });
    }

    const summary = await createAnalyticsService(db).getSummary({ now: NOW });
    const labels = summary.salesByTag.map((s) => s.label).sort();
    expect(labels).toEqual(['Other', 'a', 'b', 'c'].sort()); // top 3 (a,b,c) + Other (d+e=300)
    expect(summary.salesByTag.find((s) => s.label === 'Other')!.valueCents).toBe(300);
    expect(summary.salesByTag.reduce((sum, s) => sum + s.valueCents, 0)).toBe(1500);
  });

  it('groups current stock by first tag, folding past the top 7 into "Other"', async () => {
    const items = createItemRepository(db);
    // 9 tags with quantities 90, 80, ... 10, plus an untagged item and a second
    // 'tag-0' item to check summing and that only the first tag counts.
    for (let i = 0; i < 9; i++) {
      await items.insert({
        name: `Item ${i}`,
        quantity: 90 - i * 10,
        unitPriceCents: 100,
        tags: [`tag-${i}`, 'ignored-second-tag'],
        note: '',
      });
    }
    await items.insert({
      name: 'Extra',
      quantity: 5,
      unitPriceCents: 100,
      tags: ['tag-0'],
      note: '',
    });
    await items.insert({ name: 'Loose', quantity: 1, unitPriceCents: 100, tags: [], note: '' });

    const res = await request(createApp(db)).get('/api/analytics/inventory').expect(200);

    expect(res.body.byTag.map((t: { label: string }) => t.label)).toEqual([
      'tag-0',
      'tag-1',
      'tag-2',
      'tag-3',
      'tag-4',
      'tag-5',
      'tag-6',
      'Other',
    ]);
    expect(res.body.byTag[0]).toEqual({ label: 'tag-0', quantity: 95, itemCount: 2 });
    // tag-7 (20) + tag-8 (10) + Untagged (1)
    expect(res.body.byTag.at(-1)).toEqual({ label: 'Other', quantity: 31, itemCount: 3 });
    expect(res.body.totalQuantity).toBe(450 + 5 + 1);
    expect(res.body.totalItems).toBe(11);
  });

  it('reports the API route with the expected shape, defaulting to the 12-month range', async () => {
    const app = createApp(db);
    const res = await request(app).get('/api/analytics/summary').expect(200);

    expect(res.body).toMatchObject({
      totalRevenueCents: expect.any(Number),
      totalExpensesCents: expect.any(Number),
      netProfitCents: expect.any(Number),
      range: '12months',
      granularity: 'month',
      buckets: expect.any(Array),
      bucketLabels: expect.any(Array),
      revenueSeries: expect.any(Array),
      expenseSeries: expect.any(Array),
      salesByTag: expect.any(Array),
    });
    expect(res.body.buckets).toHaveLength(12);
  });

  it('honors the `range` query param (the "Show by" filter, shared by every chart) and rejects unknown values', async () => {
    const app = createApp(db);

    // Date-independent, so these are safe to assert exactly against real "now".
    const week = await request(app).get('/api/analytics/summary?range=week').expect(200);
    expect(week.body).toMatchObject({ range: 'week', granularity: 'day' });
    expect(week.body.buckets).toHaveLength(7);

    const twelveMonths = await request(app)
      .get('/api/analytics/summary?range=12months')
      .expect(200);
    expect(twelveMonths.body).toMatchObject({ range: '12months', granularity: 'month' });
    expect(twelveMonths.body.buckets).toHaveLength(12);

    const month = await request(app).get('/api/analytics/summary?range=month').expect(200);
    expect(month.body).toMatchObject({ range: 'month', granularity: 'day' });

    const ytd = await request(app).get('/api/analytics/summary?range=ytd').expect(200);
    expect(ytd.body).toMatchObject({ range: 'ytd', granularity: 'month' });
    expect(ytd.body.buckets.length).toBeLessThanOrEqual(12);

    await request(app).get('/api/analytics/summary?range=quarter').expect(400);
  });
});
