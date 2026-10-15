import '../../env.js';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { connectDatabase, type Db } from '../../db/database.js';

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

  beforeAll(async () => {
    db = await connectDatabase({ connectionString: testDatabaseUrl! });
    app = createApp(db);
  });

  beforeEach(async () => {
    await db.query('TRUNCATE sale_items, sales, items RESTART IDENTITY');
  });

  afterAll(async () => {
    await db?.end();
  });

  describe('/api/items', () => {
    it('creates an item and applies defaults', async () => {
      const res = await request(app).post('/api/items').send(candle).expect(201);
      expect(res.body).toMatchObject({ id: 1, ...candle, note: '' });
      expect(new Date(res.body.createdAt).toString()).not.toBe('Invalid Date');
    });

    it('rejects invalid input with field-level details', async () => {
      const res = await request(app)
        .post('/api/items')
        .send({ name: '', quantity: -1, unitPriceCents: 1.5 })
        .expect(400);
      const fields = res.body.error.details.map((d: { field: string }) => d.field);
      expect(fields).toEqual(expect.arrayContaining(['name', 'quantity', 'unitPriceCents']));
    });

    it('rejects malformed JSON and out-of-range numbers', async () => {
      await request(app)
        .post('/api/items')
        .set('Content-Type', 'application/json')
        .send('{"name":')
        .expect(400);
      await request(app)
        .post('/api/items')
        .send({ ...candle, quantity: 3_000_000_000 })
        .expect(400);
      await request(app).get('/api/items/99999999999').expect(400);
    });

    it('paginates and searches by name or tag', async () => {
      for (let i = 1; i <= 12; i++) {
        await request(app)
          .post('/api/items')
          .send({
            name: `Soap ${i}`,
            quantity: i,
            unitPriceCents: 500,
            tags: i === 12 ? ['gift'] : [],
          });
      }

      const page2 = await request(app).get('/api/items?page=2&pageSize=5').expect(200);
      expect(page2.body).toMatchObject({ page: 2, pageSize: 5, total: 12, totalPages: 3 });
      expect(page2.body.data.map((i: { name: string }) => i.name)).toEqual([
        'Soap 6',
        'Soap 7',
        'Soap 8',
        'Soap 9',
        'Soap 10',
      ]);

      const byTag = await request(app).get('/api/items?search=GIFT').expect(200);
      expect(byTag.body.total).toBe(1);

      const literalPercent = await request(app).get('/api/items?search=%25').expect(200);
      expect(literalPercent.body.total).toBe(0);
    });

    it('partially updates without touching other fields', async () => {
      await request(app).post('/api/items').send(candle);
      const res = await request(app)
        .patch('/api/items/1')
        .send({ unitPriceCents: 1000 })
        .expect(200);
      expect(res.body).toMatchObject({ ...candle, unitPriceCents: 1000 });
    });

    it('returns 404 for missing items and 400 for bad ids', async () => {
      await request(app).get('/api/items/999').expect(404);
      await request(app).patch('/api/items/999').send({ quantity: 1 }).expect(404);
      await request(app).delete('/api/items/999').expect(404);
      await request(app).get('/api/items/abc').expect(400);
    });

    it('deletes one item and bulk deletes several', async () => {
      for (let i = 0; i < 4; i++) await request(app).post('/api/items').send(candle);

      await request(app).delete('/api/items/1').expect(204);
      const bulk = await request(app)
        .post('/api/items/bulk-delete')
        .send({ ids: [2, 3, 3] })
        .expect(200);
      expect(bulk.body).toEqual({ deleted: 2 });

      const remaining = await request(app).get('/api/items').expect(200);
      expect(remaining.body.data.map((i: { id: number }) => i.id)).toEqual([4]);
    });
  });

  describe('/api/sales', () => {
    const soap = { name: 'Oatmeal soap', quantity: 20, unitPriceCents: 700, tags: [] };

    it('records a multi-item sale, snapshots prices, and decrements stock', async () => {
      await request(app).post('/api/items').send(candle); // id 1, qty 10, 1800c
      await request(app).post('/api/items').send(soap); // id 2, qty 20, 700c

      const res = await request(app)
        .post('/api/sales')
        .send({
          soldAt: '2026-10-12T15:00:00Z',
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

      const candleAfter = await request(app).get('/api/items/1').expect(200);
      expect(candleAfter.body.quantity).toBe(8);
      const soapAfter = await request(app).get('/api/items/2').expect(200);
      expect(soapAfter.body.quantity).toBe(17);
    });

    it('rejects a sale for a missing item or insufficient stock', async () => {
      await request(app).post('/api/items').send(candle); // qty 10

      await request(app)
        .post('/api/sales')
        .send({ soldAt: '2026-10-12T15:00:00Z', items: [{ itemId: 99, quantity: 1 }] })
        .expect(400);

      const res = await request(app)
        .post('/api/sales')
        .send({ soldAt: '2026-10-12T15:00:00Z', items: [{ itemId: 1, quantity: 11 }] })
        .expect(400);
      expect(res.body.error.message).toMatch(/not enough stock/i);

      // Neither failed attempt should have touched stock.
      const candleAfter = await request(app).get('/api/items/1').expect(200);
      expect(candleAfter.body.quantity).toBe(10);
    });

    it('editing a sale adjusts stock by the difference, not the full amount', async () => {
      await request(app).post('/api/items').send(candle); // qty 10

      await request(app)
        .post('/api/sales')
        .send({ soldAt: '2026-10-12T15:00:00Z', items: [{ itemId: 1, quantity: 3 }] })
        .expect(201);
      expect((await request(app).get('/api/items/1')).body.quantity).toBe(7);

      // Editing to sell 5 instead of 3 should only take 2 more off stock (7 -> 5).
      const updated = await request(app)
        .patch('/api/sales/1')
        .send({
          soldAt: '2026-10-13T15:00:00Z',
          tags: ['online'],
          items: [{ itemId: 1, quantity: 5 }],
        })
        .expect(200);
      expect(updated.body).toMatchObject({ tags: ['online'], totalCents: 1800 * 5 });
      expect((await request(app).get('/api/items/1')).body.quantity).toBe(5);

      await request(app)
        .patch('/api/sales/999')
        .send({ soldAt: '2026-10-13T15:00:00Z', items: [{ itemId: 1, quantity: 1 }] })
        .expect(404);
    });

    it('deleting a sale restores stock, and bulk delete restores several', async () => {
      await request(app).post('/api/items').send(candle); // qty 10
      await request(app).post('/api/items').send(soap); // qty 20

      await request(app)
        .post('/api/sales')
        .send({ soldAt: '2026-10-12T15:00:00Z', items: [{ itemId: 1, quantity: 4 }] })
        .expect(201);
      await request(app)
        .post('/api/sales')
        .send({ soldAt: '2026-10-12T15:00:00Z', items: [{ itemId: 2, quantity: 5 }] })
        .expect(201);

      await request(app).delete('/api/sales/1').expect(204);
      expect((await request(app).get('/api/items/1')).body.quantity).toBe(10);
      await request(app).delete('/api/sales/999').expect(404);

      const bulk = await request(app)
        .post('/api/sales/bulk-delete')
        .send({ ids: [2, 2] })
        .expect(200);
      expect(bulk.body).toEqual({ deleted: 1 });
      expect((await request(app).get('/api/items/2')).body.quantity).toBe(20);
    });

    it('lists and paginates sales, most recent first', async () => {
      await request(app).post('/api/items').send(candle);
      for (let i = 1; i <= 3; i++) {
        await request(app)
          .post('/api/sales')
          .send({ soldAt: `2026-10-1${i}T12:00:00Z`, items: [{ itemId: 1, quantity: 1 }] });
      }

      const page = await request(app).get('/api/sales?page=1&pageSize=2').expect(200);
      expect(page.body).toMatchObject({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
      expect(page.body.data.map((s: { id: number }) => s.id)).toEqual([3, 2]);
    });
  });

  describe('other routes', () => {
    it('reports health including the database', async () => {
      const res = await request(app).get('/api/health').expect(200);
      expect(res.body).toEqual({ status: 'ok', database: 'ok' });
    });

    it('returns a JSON 404 for unknown API routes', async () => {
      const res = await request(app).get('/api/nope').expect(404);
      expect(res.body.error.message).toContain('/api/nope');
    });
  });
});
