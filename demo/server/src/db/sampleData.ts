import { createItemRepository } from '../modules/items/items.repository.js';
import { runInTransaction, type Db } from './database.js';

const SAMPLE_ITEMS: [name: string, quantity: number, priceCents: number, tags: string[]][] = [
  ['Lavender soy candle', 40, 1800, ['candles', 'bestseller']],
  ['Cedar soy candle', 25, 1800, ['candles']],
  ['Beeswax tea lights (12 pack)', 60, 1200, ['candles']],
  ['Oatmeal goat milk soap', 80, 700, ['soap', 'bestseller']],
  ['Charcoal detox soap', 45, 750, ['soap']],
  ['Citrus shea body butter', 30, 1500, ['skincare']],
  ['Peppermint lip balm', 120, 400, ['skincare', 'small']],
  ['Handmade ceramic mug', 18, 3200, ['ceramics']],
  ['Ceramic planter (small)', 12, 2600, ['ceramics', 'home']],
  ['Ceramic planter (large)', 6, 4800, ['ceramics', 'home']],
  ['Linen tea towel', 35, 1400, ['textiles', 'home']],
  ['Knitted wool beanie', 20, 3500, ['textiles', 'winter']],
  ['Hand-dyed silk scarf', 10, 5500, ['textiles']],
  ['Botanical art print A4', 50, 2000, ['prints']],
  ['Botanical art print A3', 25, 3500, ['prints']],
  ['Greeting card set (5)', 70, 1500, ['stationery']],
  ['Recycled paper notebook', 55, 1100, ['stationery']],
  ['Enamel pin', 150, 1000, ['accessories', 'small']],
  ['Canvas tote bag', 40, 2200, ['accessories']],
  ['Maple syrup (250 ml)', 30, 1300, ['food']],
  ['Small-batch hot sauce', 48, 1200, ['food']],
  ['Granola (500 g)', 22, 1000, ['food']],
  ['Gift wrapping', 999, 300, ['service']],
  ['Custom engraving', 999, 1500, ['service']],
];

export type SeedResult = { seeded: number } | { skipped: true; existing: number };

/**
 * Inserts the sample inventory. Without `force` it only seeds an empty database;
 * with `force` it deletes all items and sales first.
 */
export async function seedSampleItems(db: Db, { force = false } = {}): Promise<SeedResult> {
  return runInTransaction(db, async (client) => {
    const { rows } = await client.query<{ count: number }>(
      'SELECT COUNT(*)::int AS count FROM items',
    );
    const existing = rows[0]?.count ?? 0;
    if (existing > 0 && !force) return { skipped: true, existing };

    if (force) {
      await client.query(
        'TRUNCATE expense_items, expenses, sale_items, sales, items RESTART IDENTITY',
      );
    }

    const items = createItemRepository(client);
    for (const [name, quantity, unitPriceCents, tags] of SAMPLE_ITEMS) {
      await items.insert({ name, quantity, unitPriceCents, tags, note: '' });
    }
    return { seeded: SAMPLE_ITEMS.length };
  });
}
