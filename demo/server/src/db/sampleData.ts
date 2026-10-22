import { createExpenseService } from '../modules/expenses/expenses.service.js';
import { createItemRepository } from '../modules/items/items.repository.js';
import { createNamedListRepository } from '../modules/namedLists/namedLists.repository.js';
import { createSaleService } from '../modules/sales/sales.service.js';
import { runInTransaction, type Db } from './database.js';

const SAMPLE_ITEMS: [name: string, quantity: number, priceCents: number, tags: string[]][] = [
  ['Lavender soy candle', 40, 1800, ['candles', 'bestseller']], // 1
  ['Cedar soy candle', 25, 1800, ['candles']], // 2
  ['Beeswax tea lights (12 pack)', 60, 1200, ['candles']], // 3
  ['Oatmeal goat milk soap', 80, 700, ['soap', 'bestseller']], // 4
  ['Charcoal detox soap', 45, 750, ['soap']], // 5
  ['Citrus shea body butter', 30, 1500, ['skincare']], // 6
  ['Peppermint lip balm', 120, 400, ['skincare', 'small']], // 7
  ['Handmade ceramic mug', 18, 3200, ['ceramics']], // 8
  ['Ceramic planter (small)', 12, 2600, ['ceramics', 'home']], // 9
  ['Ceramic planter (large)', 6, 4800, ['ceramics', 'home']], // 10
  ['Linen tea towel', 35, 1400, ['textiles', 'home']], // 11
  ['Knitted wool beanie', 20, 3500, ['textiles', 'winter']], // 12
  ['Hand-dyed silk scarf', 10, 5500, ['textiles']], // 13
  ['Botanical art print A4', 50, 2000, ['prints']], // 14
  ['Botanical art print A3', 25, 3500, ['prints']], // 15
  ['Greeting card set (5)', 70, 1500, ['stationery']], // 16
  ['Recycled paper notebook', 55, 1100, ['stationery']], // 17
  ['Enamel pin', 150, 1000, ['accessories', 'small']], // 18
  ['Canvas tote bag', 40, 2200, ['accessories']], // 19
  ['Maple syrup (250 ml)', 30, 1300, ['food']], // 20
  ['Small-batch hot sauce', 48, 1200, ['food']], // 21
  ['Granola (500 g)', 22, 1000, ['food']], // 22
  ['Gift wrapping', 999, 300, ['service']], // 23
  ['Custom engraving', 999, 1500, ['service']], // 24
];

/** index into SAMPLE_ITEMS (1-based, matching the comments above) */
type ItemRef = number;

interface SampleSale {
  monthsAgo: number;
  day: number;
  tags: string[];
  lines: [ItemRef, quantity: number][];
}

interface SampleExpenseItemLine {
  itemId: ItemRef;
  quantity: number;
  unitCostCents: number;
}

interface SampleExpenseFreeLine {
  description: string;
  quantity: number;
  unitCostCents: number;
}

interface SampleExpense {
  daysAgo?: number;
  monthsAgo?: number;
  day?: number;
  tags: string[];
  lines: (SampleExpenseItemLine | SampleExpenseFreeLine)[];
}

// Spread across the last ~6 months so the Analytics "Revenue Overview" chart
// has real month-to-month variation. Each sale is tagged with its first line
// item's own product category (candles / soap / skincare / ... — the same tags
// SAMPLE_ITEMS already carries), not a sales channel, so the chart's
// top-3-tags-by-revenue grouping shows real product categories.
const SAMPLE_SALES: SampleSale[] = [
  {
    monthsAgo: 5,
    day: 10,
    tags: ['candles'],
    lines: [
      [1, 2],
      [4, 3],
    ],
  },
  { monthsAgo: 5, day: 18, tags: ['stationery'], lines: [[16, 2]] },
  { monthsAgo: 5, day: 25, tags: ['skincare'], lines: [[7, 4]] },
  {
    monthsAgo: 4,
    day: 8,
    tags: ['prints'],
    lines: [
      [14, 1],
      [18, 5],
    ],
  },
  { monthsAgo: 4, day: 15, tags: ['candles'], lines: [[3, 3]] },
  { monthsAgo: 4, day: 22, tags: ['accessories'], lines: [[19, 2]] },
  {
    monthsAgo: 3,
    day: 5,
    tags: ['candles'],
    lines: [
      [1, 1],
      [9, 1],
    ],
  },
  {
    monthsAgo: 3,
    day: 14,
    tags: ['food'],
    lines: [
      [20, 2],
      [21, 1],
    ],
  },
  { monthsAgo: 3, day: 28, tags: ['soap'], lines: [[4, 2]] },
  { monthsAgo: 2, day: 3, tags: ['ceramics'], lines: [[8, 1]] },
  {
    monthsAgo: 2,
    day: 12,
    tags: ['stationery'],
    lines: [
      [16, 3],
      [17, 2],
    ],
  },
  { monthsAgo: 2, day: 20, tags: ['candles'], lines: [[1, 3]] },
  { monthsAgo: 1, day: 6, tags: ['textiles'], lines: [[13, 1]] },
  {
    monthsAgo: 1,
    day: 16,
    tags: ['candles'],
    lines: [
      [3, 4],
      [7, 2],
    ],
  },
  {
    monthsAgo: 1,
    day: 27,
    tags: ['accessories'],
    lines: [
      [19, 1],
      [22, 2],
    ],
  },
  { monthsAgo: 0, day: 2, tags: ['candles'], lines: [[1, 2]] },
  {
    monthsAgo: 0,
    day: 9,
    tags: ['prints'],
    lines: [
      [14, 2],
      [16, 1],
    ],
  },
  {
    monthsAgo: 0,
    day: 15,
    tags: ['soap'],
    lines: [
      [4, 3],
      [21, 1],
    ],
  },
];

// Several within the last 7 days so "Expenses Overview" (a 7-day window) has
// real daily variation; a few further back for total/restock-spend variety.
const SAMPLE_EXPENSES: SampleExpense[] = [
  {
    daysAgo: 0,
    tags: ['supplies'],
    lines: [{ description: 'Packaging tape & boxes', quantity: 1, unitCostCents: 4500 }],
  },
  { daysAgo: 1, tags: ['supplier'], lines: [{ itemId: 4, quantity: 30, unitCostCents: 300 }] },
  {
    daysAgo: 2,
    tags: ['market'],
    lines: [{ description: 'Craft fair booth fee', quantity: 1, unitCostCents: 5000 }],
  },
  { daysAgo: 3, tags: ['supplier'], lines: [{ itemId: 1, quantity: 15, unitCostCents: 700 }] },
  {
    daysAgo: 4,
    tags: ['utilities'],
    lines: [{ description: 'Electricity bill', quantity: 1, unitCostCents: 8500 }],
  },
  {
    daysAgo: 5,
    tags: ['supplies'],
    lines: [{ description: 'Labels & ribbon', quantity: 1, unitCostCents: 3200 }],
  },
  { daysAgo: 6, tags: ['supplier'], lines: [{ itemId: 16, quantity: 40, unitCostCents: 500 }] },
  {
    monthsAgo: 1,
    day: 10,
    tags: ['rent'],
    lines: [{ description: 'Studio rent', quantity: 1, unitCostCents: 80000 }],
  },
  {
    monthsAgo: 2,
    day: 10,
    tags: ['rent'],
    lines: [{ description: 'Studio rent', quantity: 1, unitCostCents: 80000 }],
  },
  {
    monthsAgo: 1,
    day: 20,
    tags: ['supplier'],
    lines: [{ itemId: 3, quantity: 30, unitCostCents: 500 }],
  },
  {
    monthsAgo: 3,
    day: 15,
    tags: ['supplier'],
    lines: [{ itemId: 8, quantity: 10, unitCostCents: 1800 }],
  },
  {
    monthsAgo: 4,
    day: 10,
    tags: ['rent'],
    lines: [{ description: 'Studio rent', quantity: 1, unitCostCents: 80000 }],
  },
];

export type SeedResult =
  { seeded: number; sales: number; expenses: number } | { skipped: true; existing: number };

/** `n` whole months before today (UTC), on day `day` at noon. */
function monthsAgoIso(n: number, day: number): string {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, day, 12));
  return date.toISOString();
}

/** `n` days before today (UTC), at noon. */
function daysAgoIso(n: number): string {
  const now = new Date();
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - n, 12),
  );
  return date.toISOString();
}

function isItemLine(
  line: SampleExpenseItemLine | SampleExpenseFreeLine,
): line is SampleExpenseItemLine {
  return 'itemId' in line;
}

/**
 * Records the sample sales and expenses through the real services, the same
 * way the app itself would, so stock ends up adjusted exactly as it would for
 * a real user (decremented by sales, incremented by restock expenses) and
 * validation (e.g. enough stock to sell) runs for real too.
 */
async function seedSampleTransactions(
  db: Db,
  itemIds: number[],
): Promise<{ sales: number; expenses: number }> {
  const sales = createSaleService(db);
  const expenses = createExpenseService(db);
  // Rotate through the channels so the sample sales aren't all in one.
  const channels = await createNamedListRepository(db, 'channels').findAll();

  for (const [index, sale] of SAMPLE_SALES.entries()) {
    await sales.recordSale({
      soldAt: monthsAgoIso(sale.monthsAgo, sale.day),
      channelId: channels[index % channels.length]!.id,
      description: '',
      tags: sale.tags,
      items: sale.lines.map(([itemRef, quantity]) => ({ itemId: itemIds[itemRef - 1]!, quantity })),
    });
  }

  for (const expense of SAMPLE_EXPENSES) {
    const incurredAt =
      expense.daysAgo !== undefined
        ? daysAgoIso(expense.daysAgo)
        : monthsAgoIso(expense.monthsAgo!, expense.day!);
    await expenses.recordExpense({
      incurredAt,
      description: '',
      tags: expense.tags,
      items: expense.lines.map((line) =>
        isItemLine(line)
          ? {
              itemId: itemIds[line.itemId - 1]!,
              description: '',
              quantity: line.quantity,
              unitCostCents: line.unitCostCents,
            }
          : {
              itemId: null,
              description: line.description,
              quantity: line.quantity,
              unitCostCents: line.unitCostCents,
            },
      ),
    });
  }

  return { sales: SAMPLE_SALES.length, expenses: SAMPLE_EXPENSES.length };
}

/**
 * Inserts the sample inventory, plus a spread of sample sales and expenses for
 * the demo (and so the Analytics dashboard has real data to show). Without
 * `force` it only seeds an empty database; with `force` it wipes everything first.
 */
export async function seedSampleItems(db: Db, { force = false } = {}): Promise<SeedResult> {
  const { rows } = await db.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM items');
  const existing = rows[0]?.count ?? 0;
  if (existing > 0 && !force) return { skipped: true, existing };

  if (force) {
    await db.query('TRUNCATE expense_items, expenses, sale_items, sales, items RESTART IDENTITY');
  }

  const itemIds = await runInTransaction(db, async (client) => {
    const items = createItemRepository(client);
    const ids: number[] = [];
    for (const [name, quantity, unitPriceCents, tags] of SAMPLE_ITEMS) {
      const item = await items.insert({ name, quantity, unitPriceCents, tags, note: '' });
      ids.push(item.id);
    }
    return ids;
  });

  const { sales, expenses } = await seedSampleTransactions(db, itemIds);
  return { seeded: SAMPLE_ITEMS.length, sales, expenses };
}
