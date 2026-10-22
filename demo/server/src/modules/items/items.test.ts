import '../../env.js';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { connectDatabase, type Db } from '../../db/database.js';
import { createAuthedAgent } from '../../test/authHelpers.js';

/**
 * These tests run against a real Postgres database given by TEST_DATABASE_URL
 * (in server/.env or the environment). Every table is emptied before each test,
 * so NEVER point it at a database whose data you care about.
 */
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  console.warn('TEST_DATABASE_URL is not set; skipping API tests. See server/.env.example.');
}

const candle = { name: 'Lavender candle', quantity: 10, unitPriceCents: 1800, tags: ['candles'] };

describe.skipIf(!testDatabaseUrl)('API', () => {
  let db: Db;
  let app: ReturnType<typeof createApp>;
  let agent: Awaited<ReturnType<typeof createAuthedAgent>>;

  beforeAll(async () => {
    db = await connectDatabase({ connectionString: testDatabaseUrl! });
    app = createApp(db);
  });

  beforeEach(async () => {
    await db.query(
      `TRUNCATE expense_items, expenses, sale_items, sales, channels, expense_tags, items,
        sessions, businesses RESTART IDENTITY CASCADE`,
    );
    // Registering fresh gives this business its own starter channels/expense
    // tags (id 1 = "In person"), so every test below that hardcodes channelId: 1
    // keeps working exactly as it did before accounts existed.
    agent = await createAuthedAgent(app);
  });

  afterAll(async () => {
    await db?.end();
  });

  describe('/api/auth', () => {
    it('registers a business, sets a session cookie, and reports it on /me', async () => {
      const fresh = request.agent(app);
      const res = await fresh
        .post('/api/auth/register')
        .send({ name: 'Soap & Co', email: 'owner@soap.example', password: 'password123' })
        .expect(201);
      expect(res.body).toMatchObject({ name: 'Soap & Co', email: 'owner@soap.example' });
      expect(res.body.passwordHash).toBeUndefined();
      expect(res.headers['set-cookie']?.[0]).toMatch(/jack_session=.+HttpOnly/);

      const me = await fresh.get('/api/auth/me').expect(200);
      expect(me.body).toMatchObject({ name: 'Soap & Co', email: 'owner@soap.example' });
    });

    it('gives a newly registered business starter channels and expense tags', async () => {
      const fresh = request.agent(app);
      await fresh
        .post('/api/auth/register')
        .send({ name: 'Soap & Co', email: 'starters@soap.example', password: 'password123' })
        .expect(201);

      const channels = await fresh.get('/api/channels').expect(200);
      expect(channels.body.map((c: { name: string }) => c.name)).toEqual([
        'In person',
        'Online',
        'Commission',
        'Misc',
      ]);
      const tags = await fresh.get('/api/expense-tags').expect(200);
      expect(tags.body.map((t: { name: string }) => t.name)).toEqual(
        expect.arrayContaining(['market', 'rent', 'supplier', 'supplies', 'utilities']),
      );
    });

    it('rejects registering the same email twice', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ name: 'A', email: 'dup@example.com', password: 'password123' })
        .expect(201);
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'B', email: 'dup@example.com', password: 'password123' })
        .expect(400);
      expect(res.body.error.message).toMatch(/already exists/i);
    });

    it('logs in with the right password and rejects the wrong one', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ name: 'Soap & Co', email: 'login@soap.example', password: 'correct-horse' })
        .expect(201);

      await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@soap.example', password: 'wrong-password' })
        .expect(401);

      const fresh = request.agent(app);
      await fresh
        .post('/api/auth/login')
        .send({ email: 'login@soap.example', password: 'correct-horse' })
        .expect(200);
      await fresh.get('/api/auth/me').expect(200);
    });

    it('logout clears the session so /me and protected routes 401', async () => {
      await agent.post('/api/auth/logout').expect(204);
      await agent.get('/api/auth/me').expect(401);
      await agent.get('/api/items').expect(401);
    });

    it('rejects protected routes with no session at all', async () => {
      await request(app).get('/api/items').expect(401);
      await request(app).get('/api/sales').expect(401);
      await request(app).get('/api/expenses').expect(401);
      await request(app).get('/api/channels').expect(401);
      await request(app).get('/api/expense-tags').expect(401);
      await request(app).get('/api/analytics/summary').expect(401);
    });
  });

  describe('cross-business isolation', () => {
    it("a business can't see, edit or delete another business's items", async () => {
      const mine = await agent.post('/api/items').send(candle).expect(201);

      const other = await createAuthedAgent(app);
      await other.get(`/api/items/${mine.body.id}`).expect(404);
      await other.patch(`/api/items/${mine.body.id}`).send({ quantity: 1 }).expect(404);
      await other.delete(`/api/items/${mine.body.id}`).expect(404);

      const otherList = await other.get('/api/items').expect(200);
      expect(otherList.body.total).toBe(0);
    });

    it("a business can't sell against another business's item or channel", async () => {
      const mine = await agent.post('/api/items').send(candle).expect(201);

      const other = await createAuthedAgent(app);
      const saleRes = await other
        .post('/api/sales')
        .send({
          soldAt: '2026-10-12T15:00:00Z',
          channelId: 1,
          items: [{ itemId: mine.body.id, quantity: 1 }],
        })
        .expect(400);
      expect(saleRes.body.error.message).toMatch(/does not exist/i);
    });

    it('a business only ever sees its own channels and expense tags', async () => {
      const mine = await agent.post('/api/channels').send({ name: 'My Pop-up' }).expect(201);

      const other = await createAuthedAgent(app);
      const otherChannels = await other.get('/api/channels').expect(200);
      expect(otherChannels.body.map((c: { name: string }) => c.name)).not.toContain('My Pop-up');
      // Both businesses can independently use the same name without colliding.
      await other.post('/api/channels').send({ name: 'My Pop-up' }).expect(201);
      expect(mine.body.name).toBe('My Pop-up');
    });
  });

  describe('/api/items', () => {
    it('creates an item and applies defaults', async () => {
      const res = await agent.post('/api/items').send(candle).expect(201);
      expect(res.body).toMatchObject({ id: 1, ...candle, note: '' });
      expect(new Date(res.body.createdAt).toString()).not.toBe('Invalid Date');
    });

    it('rejects invalid input with field-level details', async () => {
      const res = await agent
        .post('/api/items')
        .send({ name: '', quantity: -1, unitPriceCents: 1.5 })
        .expect(400);
      const fields = res.body.error.details.map((d: { field: string }) => d.field);
      expect(fields).toEqual(expect.arrayContaining(['name', 'quantity', 'unitPriceCents']));
    });

    it('rejects malformed JSON and out-of-range numbers', async () => {
      await agent
        .post('/api/items')
        .set('Content-Type', 'application/json')
        .send('{"name":')
        .expect(400);
      await agent
        .post('/api/items')
        .send({ ...candle, quantity: 3_000_000_000 })
        .expect(400);
      await agent.get('/api/items/99999999999').expect(400);
    });

    it('paginates and searches by name or tag', async () => {
      for (let i = 1; i <= 12; i++) {
        await agent.post('/api/items').send({
          name: `Soap ${i}`,
          quantity: i,
          unitPriceCents: 500,
          tags: i === 12 ? ['gift'] : [],
        });
      }

      const page2 = await agent.get('/api/items?page=2&pageSize=5').expect(200);
      expect(page2.body).toMatchObject({ page: 2, pageSize: 5, total: 12, totalPages: 3 });
      expect(page2.body.data.map((i: { name: string }) => i.name)).toEqual([
        'Soap 6',
        'Soap 7',
        'Soap 8',
        'Soap 9',
        'Soap 10',
      ]);

      const byTag = await agent.get('/api/items?search=GIFT').expect(200);
      expect(byTag.body.total).toBe(1);

      const literalPercent = await agent.get('/api/items?search=%25').expect(200);
      expect(literalPercent.body.total).toBe(0);
    });

    it('partially updates without touching other fields', async () => {
      await agent.post('/api/items').send(candle);
      const res = await agent.patch('/api/items/1').send({ unitPriceCents: 1000 }).expect(200);
      expect(res.body).toMatchObject({ ...candle, unitPriceCents: 1000 });
    });

    it('returns 404 for missing items and 400 for bad ids', async () => {
      await agent.get('/api/items/999').expect(404);
      await agent.patch('/api/items/999').send({ quantity: 1 }).expect(404);
      await agent.delete('/api/items/999').expect(404);
      await agent.get('/api/items/abc').expect(400);
    });

    it('deletes one item and bulk deletes several', async () => {
      for (let i = 0; i < 4; i++) await agent.post('/api/items').send(candle);

      await agent.delete('/api/items/1').expect(204);
      const bulk = await agent
        .post('/api/items/bulk-delete')
        .send({ ids: [2, 3, 3] })
        .expect(200);
      expect(bulk.body).toEqual({ deleted: 2 });

      const remaining = await agent.get('/api/items').expect(200);
      expect(remaining.body.data.map((i: { id: number }) => i.id)).toEqual([4]);
    });

    it('sorts by a whitelisted column in either direction, and rejects unknown ones', async () => {
      const rows = [
        { name: 'banana', quantity: 3, unitPriceCents: 300 },
        { name: 'Apple', quantity: 9, unitPriceCents: 100 },
        { name: 'cherry', quantity: 1, unitPriceCents: 200 },
      ];
      for (const row of rows) await agent.post('/api/items').send({ ...candle, ...row });
      const names = (res: request.Response) => res.body.data.map((i: { name: string }) => i.name);

      // Case-insensitive name sort: "Apple" first, not after the lowercase names.
      const byName = await agent.get('/api/items?sort=name').expect(200);
      expect(names(byName)).toEqual(['Apple', 'banana', 'cherry']);
      const byQtyDesc = await agent.get('/api/items?sort=quantity&order=desc').expect(200);
      expect(names(byQtyDesc)).toEqual(['Apple', 'banana', 'cherry']);
      const byPrice = await agent.get('/api/items?sort=unitPriceCents').expect(200);
      expect(names(byPrice)).toEqual(['Apple', 'cherry', 'banana']);
      // Default is unchanged: id ascending.
      const byDefault = await agent.get('/api/items').expect(200);
      expect(names(byDefault)).toEqual(['banana', 'Apple', 'cherry']);

      await agent.get('/api/items?sort=note').expect(400);
      await agent.get('/api/items?order=sideways').expect(400);
    });

    it("reports stock value and this month's top 3 sellers", async () => {
      const soap = { name: 'Soap', quantity: 50, unitPriceCents: 700, tags: [] };
      const ids: number[] = [];
      for (const [name, quantity, unitPriceCents] of [
        ['A', 50, 100],
        ['B', 50, 200],
        ['C', 50, 300],
        ['D', 50, 400],
      ] as const) {
        const res = await agent
          .post('/api/items')
          .send({ ...soap, name, quantity, unitPriceCents })
          .expect(201);
        ids.push(res.body.id);
      }
      const thisMonth = new Date().toISOString();
      const sell = (itemId: number, quantity: number, soldAt = thisMonth) =>
        agent
          .post('/api/sales')
          .send({ soldAt, channelId: 1, items: [{ itemId, quantity }] })
          .expect(201);
      await sell(ids[0]!, 5);
      await sell(ids[1]!, 2);
      await sell(ids[1]!, 2); // B: 4 total, across two sales
      await sell(ids[2]!, 1);
      await sell(ids[3]!, 9, '2020-01-15T00:00:00Z'); // D: long ago, not this month

      const res = await agent.get('/api/items/insights').expect(200);
      expect(res.body.bestSellers.map((b: { name: string }) => b.name)).toEqual(['A', 'B', 'C']);
      expect(res.body.bestSellers[1]).toMatchObject({ unitsSold: 4, revenueCents: 800 });
      // Stock after sales: A 45, B 46, C 49, D 41 (the old sale still took stock).
      expect(res.body.totalUnits).toBe(45 + 46 + 49 + 41);
      expect(res.body.stockValueCents).toBe(45 * 100 + 46 * 200 + 49 * 300 + 41 * 400);
    });

    it('reports low stock (at or below 5), naming the 5 lowest, lowest first', async () => {
      const quantities = [9, 0, 5, 6, 3, 1, 4, 2];
      for (const [i, quantity] of quantities.entries()) {
        await agent.post('/api/items').send({ ...candle, name: `Item ${i}`, quantity });
      }

      const res = await agent.get('/api/items/low-stock').expect(200);
      expect(res.body.count).toBe(6); // 0, 1, 2, 3, 4, 5 — not 6 or 9
      expect(res.body.threshold).toBe(5);
      expect(res.body.items.map((i: { quantity: number }) => i.quantity)).toEqual([0, 1, 2, 3, 4]);

      // `limit` lists more (the count is unaffected), and is validated.
      const all = await agent.get('/api/items/low-stock?limit=100').expect(200);
      expect(all.body.count).toBe(6);
      expect(all.body.items).toHaveLength(6);
      await agent.get('/api/items/low-stock?limit=0').expect(400);
    });
  });

  describe('/api/sales', () => {
    const soap = { name: 'Oatmeal soap', quantity: 20, unitPriceCents: 700, tags: [] };

    it('records a multi-item sale, snapshots prices, and decrements stock', async () => {
      await agent.post('/api/items').send(candle); // id 1, qty 10, 1800c
      await agent.post('/api/items').send(soap); // id 2, qty 20, 700c

      const res = await agent
        .post('/api/sales')
        .send({
          soldAt: '2026-10-12T15:00:00Z',
          channelId: 1,
          tags: ['market'],
          items: [
            { itemId: 1, quantity: 2 },
            { itemId: 2, quantity: 3 },
          ],
        })
        .expect(201);

      expect(res.body).toMatchObject({
        id: 1,
        soldAt: '2026-10-12T15:00:00.000Z',
        tags: ['market'],
        totalCents: 1800 * 2 + 700 * 3,
        items: [
          { itemId: 1, itemName: 'Lavender candle', quantity: 2, unitPriceCents: 1800 },
          { itemId: 2, itemName: 'Oatmeal soap', quantity: 3, unitPriceCents: 700 },
        ],
      });

      const candleAfter = await agent.get('/api/items/1').expect(200);
      expect(candleAfter.body.quantity).toBe(8);
      const soapAfter = await agent.get('/api/items/2').expect(200);
      expect(soapAfter.body.quantity).toBe(17);
    });

    it('rejects a sale for a missing item or insufficient stock', async () => {
      await agent.post('/api/items').send(candle); // qty 10

      await agent
        .post('/api/sales')
        .send({
          soldAt: '2026-10-12T15:00:00Z',
          channelId: 1,
          items: [{ itemId: 99, quantity: 1 }],
        })
        .expect(400);

      const res = await agent
        .post('/api/sales')
        .send({
          soldAt: '2026-10-12T15:00:00Z',
          channelId: 1,
          items: [{ itemId: 1, quantity: 11 }],
        })
        .expect(400);
      expect(res.body.error.message).toMatch(/not enough stock/i);

      // Neither failed attempt should have touched stock.
      const candleAfter = await agent.get('/api/items/1').expect(200);
      expect(candleAfter.body.quantity).toBe(10);
    });

    it('editing a sale adjusts stock by the difference, not the full amount', async () => {
      await agent.post('/api/items').send(candle); // qty 10

      await agent
        .post('/api/sales')
        .send({ soldAt: '2026-10-12T15:00:00Z', channelId: 1, items: [{ itemId: 1, quantity: 3 }] })
        .expect(201);
      expect((await agent.get('/api/items/1')).body.quantity).toBe(7);

      // Editing to sell 5 instead of 3 should only take 2 more off stock (7 -> 5).
      const updated = await agent
        .patch('/api/sales/1')
        .send({
          soldAt: '2026-10-13T15:00:00Z',
          channelId: 1,
          tags: ['online'],
          items: [{ itemId: 1, quantity: 5 }],
        })
        .expect(200);
      expect(updated.body).toMatchObject({ tags: ['online'], totalCents: 1800 * 5 });
      expect((await agent.get('/api/items/1')).body.quantity).toBe(5);

      await agent
        .patch('/api/sales/999')
        .send({ soldAt: '2026-10-13T15:00:00Z', channelId: 1, items: [{ itemId: 1, quantity: 1 }] })
        .expect(404);
    });

    it('deleting a sale restores stock, and bulk delete restores several', async () => {
      await agent.post('/api/items').send(candle); // qty 10
      await agent.post('/api/items').send(soap); // qty 20

      await agent
        .post('/api/sales')
        .send({ soldAt: '2026-10-12T15:00:00Z', channelId: 1, items: [{ itemId: 1, quantity: 4 }] })
        .expect(201);
      await agent
        .post('/api/sales')
        .send({ soldAt: '2026-10-12T15:00:00Z', channelId: 1, items: [{ itemId: 2, quantity: 5 }] })
        .expect(201);

      await agent.delete('/api/sales/1').expect(204);
      expect((await agent.get('/api/items/1')).body.quantity).toBe(10);
      await agent.delete('/api/sales/999').expect(404);

      const bulk = await agent
        .post('/api/sales/bulk-delete')
        .send({ ids: [2, 2] })
        .expect(200);
      expect(bulk.body).toEqual({ deleted: 1 });
      expect((await agent.get('/api/items/2')).body.quantity).toBe(20);
    });

    it('sorts sales by id, date, total or first tag, defaulting to newest first', async () => {
      const item = await agent
        .post('/api/items')
        .send({ name: 'Mug', quantity: 100, unitPriceCents: 500, tags: [] })
        .expect(201);
      const sell = (soldAt: string, quantity: number, tags: string[]) =>
        agent
          .post('/api/sales')
          .send({ soldAt, channelId: 1, tags, items: [{ itemId: item.body.id, quantity }] })
          .expect(201);
      await sell('2026-03-02T00:00:00Z', 3, ['market']); // id 1, 1500
      await sell('2026-03-05T00:00:00Z', 1, []); // id 2, 500, untagged
      await sell('2026-03-01T00:00:00Z', 5, ['Online']); // id 3, 2500
      const ids = (res: request.Response) => res.body.data.map((s: { id: number }) => s.id);

      expect(ids(await agent.get('/api/sales').expect(200))).toEqual([2, 1, 3]);
      expect(ids(await agent.get('/api/sales?sort=id&order=asc').expect(200))).toEqual([1, 2, 3]);
      expect(ids(await agent.get('/api/sales?sort=total&order=desc').expect(200))).toEqual([
        3, 1, 2,
      ]);
      // Case-insensitive first tag; the untagged sale is last in both directions.
      expect(ids(await agent.get('/api/sales?sort=tags&order=asc').expect(200))).toEqual([1, 3, 2]);
      expect(ids(await agent.get('/api/sales?sort=tags&order=desc').expect(200))).toEqual([
        3, 1, 2,
      ]);
      await agent.get('/api/sales?sort=items').expect(400);
    });

    it("summarizes this month's sales: count, average and largest", async () => {
      const empty = await agent.get('/api/sales/month-summary').expect(200);
      expect(empty.body).toMatchObject({ saleCount: 0, averageSaleCents: 0, largestSale: null });

      const item = await agent
        .post('/api/items')
        .send({ name: 'Mug', quantity: 100, unitPriceCents: 500, tags: [] })
        .expect(201);
      const sell = (soldAt: string, quantity: number) =>
        agent
          .post('/api/sales')
          .send({ soldAt, channelId: 1, items: [{ itemId: item.body.id, quantity }] })
          .expect(201);
      const now = new Date().toISOString();
      await sell(now, 1); // 500
      await sell(now, 4); // 2000, the largest
      await sell(now, 2); // 1000
      await sell('2020-01-15T00:00:00Z', 50); // long ago: excluded

      const res = await agent.get('/api/sales/month-summary').expect(200);
      expect(res.body).toMatchObject({
        saleCount: 3,
        revenueCents: 3500,
        averageSaleCents: 1167, // 3500 / 3, rounded
        largestSale: { totalCents: 2000 },
      });
    });

    it('lists and paginates sales, most recent first', async () => {
      await agent.post('/api/items').send(candle);
      for (let i = 1; i <= 3; i++) {
        await agent.post('/api/sales').send({
          soldAt: `2026-10-1${i}T12:00:00Z`,
          channelId: 1,
          items: [{ itemId: 1, quantity: 1 }],
        });
      }

      const page = await agent.get('/api/sales?page=1&pageSize=2').expect(200);
      expect(page.body).toMatchObject({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
      expect(page.body.data.map((s: { id: number }) => s.id)).toEqual([3, 2]);
    });

    it('requires a real channel and defaults the description to the items', async () => {
      await agent.post('/api/items').send(candle); // id 1
      await agent.post('/api/items').send(soap); // id 2
      const lines = [
        { itemId: 1, quantity: 2 },
        { itemId: 2, quantity: 1 },
      ];

      await agent
        .post('/api/sales')
        .send({ soldAt: '2026-10-12T15:00:00Z', items: lines })
        .expect(400);
      await agent
        .post('/api/sales')
        .send({ soldAt: '2026-10-12T15:00:00Z', channelId: 999_999, items: lines })
        .expect(400);

      const res = await agent
        .post('/api/sales')
        .send({ soldAt: '2026-10-12T15:00:00Z', channelId: 1, items: lines })
        .expect(201);
      expect(res.body).toMatchObject({
        channel: { id: 1, name: 'In person' },
        description: 'Lavender candle x 2, Oatmeal soap x 1',
      });

      const custom = await agent
        .patch('/api/sales/1')
        .send({
          soldAt: '2026-10-12T15:00:00Z',
          channelId: 1,
          description: ' Gift set ',
          items: lines,
        })
        .expect(200);
      expect(custom.body.description).toBe('Gift set');
    });
  });

  describe('/api/channels', () => {
    it('starts with the default channels', async () => {
      const res = await agent.get('/api/channels').expect(200);
      expect(res.body.map((c: { name: string }) => c.name)).toEqual([
        'In person',
        'Online',
        'Commission',
        'Misc',
      ]);
    });

    it('adds a channel, rejecting blank and case-insensitive duplicate names', async () => {
      const res = await agent.post('/api/channels').send({ name: 'Etsy' }).expect(201);
      expect(res.body).toEqual({ id: expect.any(Number), name: 'Etsy' });

      const list = await agent.get('/api/channels').expect(200);
      expect(list.body).toContainEqual(res.body);

      await agent.post('/api/channels').send({ name: 'ETSY' }).expect(409);
      await agent.post('/api/channels').send({ name: '  ' }).expect(400);
    });
  });

  describe('/api/expense-tags', () => {
    it('starts with the default tags and adds new ones with a 30-character limit', async () => {
      const res = await agent.get('/api/expense-tags').expect(200);
      expect(res.body.map((t: { name: string }) => t.name)).toEqual(
        expect.arrayContaining(['market', 'rent', 'supplier', 'supplies', 'utilities']),
      );

      const created = await agent.post('/api/expense-tags').send({ name: 'shipping' }).expect(201);
      expect(created.body).toEqual({ id: expect.any(Number), name: 'shipping' });
      await agent.post('/api/expense-tags').send({ name: 'SHIPPING' }).expect(409);
      await agent
        .post('/api/expense-tags')
        .send({ name: 'x'.repeat(31) })
        .expect(400);
    });
  });

  describe('/api/expenses', () => {
    it('sorts expenses by id, date, total or first tag, defaulting to newest first', async () => {
      const record = (incurredAt: string, unitCostCents: number, tags: string[]) =>
        agent
          .post('/api/expenses')
          .send({ incurredAt, tags, items: [{ description: 'Cost', quantity: 1, unitCostCents }] })
          .expect(201);
      await record('2026-03-02T00:00:00Z', 1500, ['supplies']); // id 1
      await record('2026-03-05T00:00:00Z', 500, []); // id 2, untagged
      await record('2026-03-01T00:00:00Z', 2500, ['Rent']); // id 3
      const ids = (res: request.Response) => res.body.data.map((e: { id: number }) => e.id);
      const get = (query: string) => agent.get(`/api/expenses${query}`).expect(200);

      expect(ids(await get(''))).toEqual([2, 1, 3]);
      expect(ids(await get('?sort=id&order=asc'))).toEqual([1, 2, 3]);
      expect(ids(await get('?sort=total&order=desc'))).toEqual([3, 1, 2]);
      // Case-insensitive first tag; the untagged expense is last in both directions.
      expect(ids(await get('?sort=tags&order=asc'))).toEqual([3, 1, 2]);
      expect(ids(await get('?sort=tags&order=desc'))).toEqual([1, 3, 2]);
      await agent.get('/api/expenses?sort=items').expect(400);
    });

    it('describes an expense from its lines unless given a description', async () => {
      await agent.post('/api/items').send(candle); // id 1
      const expense = {
        incurredAt: '2026-10-12T15:00:00Z',
        items: [
          { itemId: 1, quantity: 5, unitCostCents: 900 },
          { description: 'Shipping', quantity: 1, unitCostCents: 1200 },
        ],
      };

      const res = await agent.post('/api/expenses').send(expense).expect(201);
      expect(res.body.description).toBe('Lavender candle x 5, Shipping x 1');

      const custom = await agent
        .patch('/api/expenses/1')
        .send({ ...expense, description: ' Market prep ' })
        .expect(200);
      expect(custom.body.description).toBe('Market prep');
    });

    it("splits this month's spending into restocks vs running costs", async () => {
      const item = await agent
        .post('/api/items')
        .send({ name: 'Mug', quantity: 1, unitPriceCents: 500, tags: [] })
        .expect(201);
      const now = new Date().toISOString();
      await agent
        .post('/api/expenses')
        .send({
          incurredAt: now,
          items: [
            { itemId: item.body.id, quantity: 10, unitCostCents: 200 }, // restock 2000
            { description: 'Card fees', quantity: 1, unitCostCents: 300 }, // running 300
          ],
        })
        .expect(201);
      await agent
        .post('/api/expenses')
        .send({
          incurredAt: '2020-01-15T00:00:00Z', // long ago: excluded
          items: [{ description: 'Old rent', quantity: 1, unitCostCents: 99900 }],
        })
        .expect(201);

      const res = await agent.get('/api/expenses/month-breakdown').expect(200);
      expect(res.body).toMatchObject({ restockCents: 2000, runningCents: 300, totalCents: 2300 });
      expect(res.body.topRestockItems).toEqual([
        { id: item.body.id, name: 'Mug', units: 10, spentCents: 2000 },
      ]);
    });

    it('records a free-text line with no stock effect', async () => {
      const res = await agent
        .post('/api/expenses')
        .send({
          incurredAt: '2026-10-12T15:00:00Z',
          tags: ['rent'],
          items: [{ description: 'Studio rent', quantity: 1, unitCostCents: 80000 }],
        })
        .expect(201);

      expect(res.body).toMatchObject({
        id: 1,
        tags: ['rent'],
        totalCents: 80000,
        items: [{ itemId: null, itemName: 'Studio rent', quantity: 1, unitCostCents: 80000 }],
      });
    });

    it('records an item-linked line and restocks it', async () => {
      await agent.post('/api/items').send(candle); // id 1, qty 10

      const res = await agent
        .post('/api/expenses')
        .send({
          incurredAt: '2026-10-12T15:00:00Z',
          items: [{ itemId: 1, quantity: 20, unitCostCents: 900 }],
        })
        .expect(201);

      expect(res.body.items[0]).toMatchObject({
        itemId: 1,
        itemName: 'Lavender candle',
        quantity: 20,
        unitCostCents: 900,
        totalCents: 18000,
      });
      expect((await agent.get('/api/items/1')).body.quantity).toBe(30);
    });

    it('rejects a line with neither an item nor a description, and an unknown item', async () => {
      await agent
        .post('/api/expenses')
        .send({ incurredAt: '2026-10-12T15:00:00Z', items: [{ quantity: 1, unitCostCents: 500 }] })
        .expect(400);

      await agent
        .post('/api/expenses')
        .send({
          incurredAt: '2026-10-12T15:00:00Z',
          items: [{ itemId: 99, quantity: 1, unitCostCents: 500 }],
        })
        .expect(400);
    });

    it('editing an expense adjusts stock by the difference', async () => {
      await agent.post('/api/items').send(candle); // qty 10

      await agent
        .post('/api/expenses')
        .send({
          incurredAt: '2026-10-12T15:00:00Z',
          items: [{ itemId: 1, quantity: 5, unitCostCents: 900 }],
        })
        .expect(201);
      expect((await agent.get('/api/items/1')).body.quantity).toBe(15);

      // Editing to restock 8 instead of 5 should only add 3 more (15 -> 18).
      const updated = await agent
        .patch('/api/expenses/1')
        .send({
          incurredAt: '2026-10-13T15:00:00Z',
          tags: ['supplier'],
          items: [{ itemId: 1, quantity: 8, unitCostCents: 850 }],
        })
        .expect(200);
      expect(updated.body).toMatchObject({ tags: ['supplier'], totalCents: 850 * 8 });
      expect((await agent.get('/api/items/1')).body.quantity).toBe(18);
    });

    it('deleting an expense undoes the restock, and bulk delete undoes several', async () => {
      await agent.post('/api/items').send(candle); // qty 10
      const soap = { name: 'Oatmeal soap', quantity: 20, unitPriceCents: 700, tags: [] };
      await agent.post('/api/items').send(soap); // id 2, qty 20

      await agent
        .post('/api/expenses')
        .send({
          incurredAt: '2026-10-12T15:00:00Z',
          items: [{ itemId: 1, quantity: 4, unitCostCents: 900 }],
        })
        .expect(201);
      await agent
        .post('/api/expenses')
        .send({
          incurredAt: '2026-10-12T15:00:00Z',
          items: [{ itemId: 2, quantity: 5, unitCostCents: 300 }],
        })
        .expect(201);

      await agent.delete('/api/expenses/1').expect(204);
      expect((await agent.get('/api/items/1')).body.quantity).toBe(10);

      const bulk = await agent
        .post('/api/expenses/bulk-delete')
        .send({ ids: [2, 2] })
        .expect(200);
      expect(bulk.body).toEqual({ deleted: 1 });
      expect((await agent.get('/api/items/2')).body.quantity).toBe(20);
    });

    it('refuses to undo a restock that would take stock negative', async () => {
      await agent.post('/api/items').send(candle); // qty 10

      await agent
        .post('/api/expenses')
        .send({
          incurredAt: '2026-10-12T15:00:00Z',
          items: [{ itemId: 1, quantity: 5, unitCostCents: 900 }],
        })
        .expect(201); // qty 10 -> 15

      // Sell more than the original stock, so undoing the restock would go negative.
      await agent
        .post('/api/sales')
        .send({
          soldAt: '2026-10-13T15:00:00Z',
          channelId: 1,
          items: [{ itemId: 1, quantity: 12 }],
        })
        .expect(201); // qty 15 -> 3

      const res = await agent.delete('/api/expenses/1').expect(400);
      expect(res.body.error.message).toMatch(/can't undo the restock/i);
      expect((await agent.get('/api/items/1')).body.quantity).toBe(3);
    });
  });

  describe('other routes', () => {
    it('reports health including the database (no auth required)', async () => {
      const res = await request(app).get('/api/health').expect(200);
      expect(res.body).toEqual({ status: 'ok', database: 'ok' });
    });

    it('returns a JSON 404 for unknown API routes', async () => {
      const res = await agent.get('/api/nope').expect(404);
      expect(res.body.error.message).toContain('/api/nope');
    });
  });
});
